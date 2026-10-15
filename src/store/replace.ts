import { now } from "../domain/clock";
import { USER } from "../domain/constants";
import { liveInvoices } from "../domain/lines";
import { payerOf, pt } from "../domain/lookup";
import { fmt, round2 } from "../domain/money";
import { cashPriceOf, insPriceOf, priceLines } from "../domain/pricing";
import { approvalOf, isApproved, replacePreview, type ReplaceTo } from "../domain/replace";
import type { Line, Visit, World } from "../domain/types";
import { markDone, payAll, t, type Fx } from "./actions";
import { raiseRefundInvoice } from "./refund";
import { logLedgerOn, recordOn } from "./world";

/* Replace (v3 lines 1385–1493, drawer refundDiff branch 5800–5819). The lines of the invoice(s) being replaced. */
export const linesOf = (c: Visit, codes: string[] | null) => (codes ? [c.consult, ...c.orders].filter((l) => codes.includes(l.code)) : null);
const histLine = (l: Line, ins: string, price: number) => ({ name: l.name, code: l.code, ins, price });

/* v3 invoiceReplace().open (line 1507): the Replace story takes over, fresh */
export function openReplaceOn(c: Visit) {
  c.activeStory = "replace";
  if (c.storyDone) delete c.storyDone.replace;
}

/* v3 undoReplace() (line 1385): the invoices are back exactly as they were, no money moved */
export function undoReplace(w: World, c: Visit, fx: Fx) {
  const b = c.bill;
  if (!b || !b.replacing) return;
  const rp = b.replacing;
  const back = rp.to === "cash" ? "insurance" : "cash";
  const lines = [c.consult, ...c.orders].filter((l) => b.codes.includes(l.code));
  lines.forEach((l) => {
    l.price = back === "cash" ? cashPriceOf(l) : insPriceOf(l);
    l.ins = back === "cash" ? "notinsured" : l.insWas || l.ins;
    const old = c.invoices.find((i) => rp.ids.includes(i.id) && (i.rows || []).some((r) => r.code === l.code));
    if (old) { l.invoiceId = old.id; l.paid = !!old.via && old.via !== "Credit"; l.via = old.via; }
    else { l.invoiceId = null; l.paid = false; l.via = null; }
  });
  rp.ids.forEach((id) => { const old = c.invoices.find((i) => i.id === id); if (old) { delete old.replaced; old.paid = old.via !== "Credit"; } });
  c.payerId = back === "cash" ? "CASH" : (pt(w, c).payers.find((p) => p.plan) || { id: c.payerId }).id;
  c.dedUsed = round2(liveInvoices(c).reduce((a, i) => a + (i.deductible || 0), 0));
  const ids = rp.ids;
  c.bill = null; c.link = null;
  recordOn(c, "i", t("hist.replaceCancelled", { to: rp.to === "cash" ? "cash" : "insurance" }),
    ids.length ? t(ids.length > 1 ? "hist.replaceLiveMany" : "hist.replaceLiveOne", { ids: ids.join(", "), back }) : t("hist.replaceNothing"),
    { type: "REPLACE_CANCEL", amount: 0, replaced: ids, invoiceId: ids[0] || null, lines: lines.map((l) => histLine(l, l.ins!, l.price)) });
  fx.toast("", t("toast.replaceCancelled"), t("toast.replaceCancelledSub"));
}

/* v3 doReplace() (line 1410). Returns the amount to give back when the patient is left in credit — the UI then
   opens the refund slide-in (v3 sets state.drawer itself). */
export function doReplace(w: World, c: Visit, to: ReplaceTo, payerId: string, only: Line[] | null, fx: Fx): { refundDiff: number } | null {
  const pv = replacePreview(w, c, to, payerId, only);
  /* the lines being re-priced: a cash patient's whole visit, or an insured patient's orders */
  pv.rows.forEach((r) => {
    const l = r.line;
    if (l.priceIns == null) l.priceIns = l.price;
    if (l.priceCash == null) l.priceCash = cashPriceOf(l);
    if (to === "cash" && l.ins !== "notinsured") l.insWas = l.ins;
    l.price = r.price; l.ins = r.ins;
    l.paid = false; l.via = null; l.invoiceId = null;
    if (to === "insurance") { delete l.urgentCash; delete l.approvalPending; delete l.approvalGranted; }
  });
  /* the visit charge decides the patient type: replacing it moves the patient onto the insurer;
     replacing an orders invoice on its own leaves the patient type alone */
  if (!pv.partial || pv.rows.some((r) => r.line === c.consult)) c.payerId = payerId;
  c.dedUsed = pv.keptDed; /* what the invoices staying put have used */
  c.link = null;
  /* a single invoice of a cash visit is priced on the insurer it is moving to */
  const ins = to === "insurance" ? pt(w, c).payers.find((p) => p.id === payerId) : undefined;
  const tl = priceLines(w, c, pv.rows.map((r) => r.line), to === "cash" ? (pv.partial ? null : undefined) : ins && ins.plan ? ins.plan : undefined);
  c.bill = {
    scope: pv.partial ? "orders" : "visit", codes: pv.rows.map((r) => r.line.code), at: now(),
    patient: tl.patient, company: tl.company, deductible: tl.deductible,
    due: round2(tl.patient - pv.oldPaid), billType: to,
    payerLabel: to === "insurance" ? (ins || payerOf(w, c)).label : null,
    replacing: { ids: pv.ids, credited: pv.oldPaid, to, partial: pv.partial },
    rows: tl.rows.map((x) => ({
      name: x.line.name, code: x.line.code, calc: x.calc, package: !!x.line.package,
      children: x.line.children ? x.line.children.map((k) => ({ code: k.code, name: k.name })) : null,
    })),
  };
  /* the switch itself is recorded, before any money moves */
  const dif = c.bill.due!;
  recordOn(c, dif > 0.004 ? "w" : "",
    t("hist.replaceStarted", { what: pv.partial ? t("hist.replaceOrders", { count: pv.rows.length }) : t("hist.replaceVisit"), to }),
    t("hist.replaceStartedSub", {
      count: pv.rows.length, ids: pv.ids.length ? t("hist.replaceReversed", { ids: pv.ids.join(", ") }) : t("hist.replaceNothingBilled"),
      total: fmt(c.bill.patient), carried: pv.oldPaid > 0 ? t("hist.replaceCarried", { amount: fmt(pv.oldPaid) }) : "",
      settle: dif > 0.004 ? t("hist.replaceToCollect", { amount: fmt(dif) }) : dif < -0.004 ? t("hist.replaceToGive", { amount: fmt(-dif) }) : t("hist.replaceSettled"),
    }),
    { type: "REPLACE_START", amount: c.bill.patient, diff: dif, credited: pv.oldPaid, to, replaced: pv.ids, invoiceId: pv.ids[0] || null,
      lines: pv.rows.map((r) => histLine(r.line, r.ins, r.price)) });
  /* nothing to move, or money to give back — settle it in one action */
  if (c.bill.due! <= 0.004) {
    const back = -c.bill.due!;
    if (back > 0.004) return { refundDiff: round2(back) };
    payAll(w, c, "Replaced", fx);
  }
  return null;
}

/* the drawer's refundDiff branch (v3 line 5800): the replacement left the patient in credit */
export function completeReplaceRefund(w: World, c: Visit, amount: number, mode: string, reason: string, detail: string, fx: Fx) {
  payAll(w, c, "Replaced", fx);
  const inv = c.invoices[0]!;
  inv.refunds = inv.refunds || [];
  const rinv = raiseRefundInvoice(w, c, inv, [], amount, 0, 0, mode, reason, detail);
  inv.refunds.push({ at: now(), amount, mode, reason, by: USER, detail, codes: [], refundInvoiceId: rinv.id });
  if (mode === "Advance wallet") {
    const wal = w.patients[c.mrn]!.wallet;
    wal.advance.Open = round2(wal.advance.Open + amount);
    logLedgerOn(w, c.mrn, { type: "REFUND_IN", amount, cat: "Open", invoiceId: inv.id, visitId: c.id, note: t("ledger.overpaidIn", { reason }) });
  }
  recordOn(c, "w", t("hist.refundOverpaid", { amount: fmt(amount) }),
    t("hist.refundOverpaidSub", { rinv: rinv.id, mode, detail: detail ? ` · ${detail}` : "", reason, inv: inv.id }),
    { type: "REFUND", invoiceId: inv.id, amount, mode, ref: detail || "", reason,
      lines: inv.rows.map((r) => ({ name: r.name, code: r.code, ins: "notcovered", price: r.calc.gross })) });
  markDone(c, "replace", t("replace.done", { ids: (inv.replaces || []).join(", "), inv: inv.id }), t("replace.doneBack", { amount: fmt(amount), mode }));
  fx.toast("warn", t("toast.refunded", { amount: fmt(amount) }), `${pt(w, c).name} · ${mode}`);
}

/* v3 checkInsurerApproval() (line 1475): asking an insurer about lines on a cash visit — it answers on the second check */
export function checkInsurerApproval(w: World, c: Visit, payerId: string, lines: Line[], fx: Fx) {
  const ins = pt(w, c).payers.find((p) => p.id === payerId)!;
  const missing = lines.filter((l) => !isApproved(approvalOf(c, l, payerId)));
  if (!missing.length) { fx.toast("", t("toast.alreadyApproved"), ins.label); return; }
  const checks = (c.insChecks = c.insChecks || {});
  checks[payerId] = (checks[payerId] || 0) + 1;
  if (checks[payerId]! < 2) {
    recordOn(c, "w", t("hist.insNoAnswer", { label: ins.label }), t("hist.insStillPending", { count: missing.length }),
      { type: "CHECK", lines: missing.map((l) => histLine(l, "pending", l.price)) });
    fx.toast("warn", t("toast.noAnswerYet"), t("toast.noAnswerYetSub", { label: ins.label, count: missing.length }));
    return;
  }
  checks[payerId] = 0;
  missing.forEach((l) => { l.appr = { ...(l.appr || {}), [payerId]: "approved" }; });
  recordOn(c, "i", t("hist.insApproved", { label: ins.label }), t("hist.insApprovedSub", { names: missing.map((l) => l.name).join(", "), label: ins.label }),
    { type: "APPROVAL", by: ins.label, lines: missing.map((l) => histLine(l, "approved", l.price)) });
  fx.toast("ok", t("toast.insApproved", { label: ins.label }), t("toast.insApprovedSub", { count: missing.length }));
}
