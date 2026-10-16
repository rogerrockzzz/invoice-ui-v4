import i18n from "../i18n";
import { LATER_ORDERS } from "../data/seed";
import { now } from "../domain/clock";
import { ADV_CATS, payMode, USER } from "../domain/constants";
import { newInvoiceId } from "../domain/ids";
import { approvedOrders, cashHeld, pendingOrders, selectedLines } from "../domain/lines";
import { payerName, payerOf, planOf, pt, walletOf } from "../domain/lookup";
import { fmt, round2 } from "../domain/money";
import { cashPriceOf, insPriceOf, isPending, priceLines } from "../domain/pricing";
import { billingType } from "../domain/replace";
import { mainStory, storyHasWork, storyLock, type StoryId } from "../domain/stories";
import type { Bill, Invoice, Line, Visit, World } from "../domain/types";
import type { PayPart } from "../domain/drawer";
import type { ToastKind } from "./toasts";
import { logLedgerOn, recordOn } from "./world";
import { undoReplace } from "./replace";

/* v3's actions (journey-opd-v3.html lines 1617–1901, 2043–2054, 3314–3387), on a plain World so they can
   run inside an immer draft or in a test. Texts are i18n keys holding v3's exact English; history keeps
   v3's light markup (<b>). Toasts are collected and fired by the caller once the change is committed. */

export interface Fx { toast: (kind: ToastKind, title: string, sub?: string) => void }
export const t = (k: string, p?: Record<string, unknown>) => i18n.t(k, p) as string;
/* v3 markDone() (line 2118): a finished story keeps its result until it is left */
export function markDone(c: Visit, id: string, title: string, sub: string) {
  c.storyDone = { ...(c.storyDone || {}), [id]: { title, sub, at: now() } };
}
const name = (w: World, c: Visit) => pt(w, c).name;
const histLines = (ls: Line[], ins?: string) => ls.map((o) => ({ name: o.name, code: o.code, ins: ins || o.ins, price: o.price }));

/* Prepare the charge. Nothing is invoiced at this point — the receptionist has only decided what is collected. */
export function startBill(w: World, c: Visit, scope: Bill["scope"], lines: Line[]) {
  const tl = priceLines(w, c, lines);
  c.bill = {
    scope, codes: lines.map((l) => l.code), at: now(),
    patient: tl.patient, company: tl.company, deductible: tl.deductible,
    rows: tl.rows.map((x) => ({
      name: x.line.name, code: x.line.code, calc: x.calc,
      /* the invoice owns its own copy of the package contents */
      package: !!x.line.package,
      children: x.line.children ? x.line.children.map((k) => ({ code: k.code, name: k.name })) : null,
    })),
  };
  return c.bill;
}

/* An order that cannot wait for its approval: billed at the cash price on its own invoice, and moved onto
   the policy as soon as the approval lands (the move itself is the Replace story, M2). */
export function startCashBill(w: World, c: Visit, lines: Line[]) {
  lines.forEach((l) => {
    if (l.priceIns == null) l.priceIns = l.price;
    if (l.priceCash == null) l.priceCash = cashPriceOf(l);
    l.insWas = l.ins;
    l.approvalPending = true;
    l.urgentCash = true;
    l.ins = "notinsured";
    l.price = l.priceCash;
  });
  const tl = priceLines(w, c, lines, null); /* no plan: a pure cash price, no payer discount */
  c.bill = {
    scope: "orders", codes: lines.map((l) => l.code), at: now(), cashOnly: true,
    patient: tl.patient, company: 0, deductible: 0,
    rows: tl.rows.map((x) => ({
      name: x.line.name, code: x.line.code, calc: x.calc, package: !!x.line.package,
      children: x.line.children ? x.line.children.map((k) => ({ code: k.code, name: k.name })) : null,
    })),
  };
  recordOn(c, "w", t("hist.cashUrgent", { count: lines.length }),
    t("hist.cashUrgentSub", { lines: lines.map((l) => t("hist.cashUrgentLine", { name: l.name, price: fmt(l.priceCash) })).join(", "), payer: payerName(w, c) }),
    { type: "CASH_URGENT", amount: tl.patient, scope: "orders", lines: histLines(lines, "notinsured") });
  return c.bill;
}

export function cancelBill(w: World, c: Visit, fx: Fx) {
  const b = c.bill;
  if (!b) return;
  if (b.replacing) return undoReplace(w, c, fx);
  const lines = [c.consult, ...c.orders].filter((l) => b.codes.includes(l.code));
  if (b.cashOnly) lines.forEach((l) => { /* the urgent cash conversion is undone too */
    l.ins = l.insWas || l.ins;
    l.price = insPriceOf(l);
    delete l.urgentCash; delete l.approvalPending; delete l.insWas;
  });
  const hadLink = !!c.link;
  c.bill = null; c.link = null;
  if (hadLink) recordOn(c, "i", t("hist.linkCancelled"), t("hist.nothingCharged"), { type: "LINKCANCEL" });
  fx.toast("", t(hadLink ? "toast.linkCancelled" : "toast.back"), t("toast.nothingCharged"));
}
export const billLabel = (c: Visit) => t(c.bill && c.bill.scope === "consult" ? "hist.label.consult" : "hist.label.orders");

/* always user-triggered: v3's settings.autoSend has no caller (Settings toggle only, M4) */
export function sendLink(w: World, c: Visit, fx: Fx, auto = false) {
  if (!c.bill) return;
  c.link = { at: now(), ageMin: 0, auto };
  recordOn(c, "i", t(auto ? "hist.linkSentAuto" : "hist.linkSent", { amount: fmt(c.bill.patient) }), t("hist.to", { mobile: pt(w, c).mobile }),
    { type: "LINK", amount: c.bill.patient, mode: "Payment link", scope: c.bill.scope, auto, by: auto ? "System" : USER });
  fx.toast("", t("toast.linkSent", { amount: fmt(c.bill.patient) }), name(w, c));
}
export function resendLink(w: World, c: Visit, fx: Fx) {
  const owed = c.bill ? (c.bill.due != null ? c.bill.due : c.bill.patient) : 0;
  c.link = { at: now(), ageMin: 0, auto: false };
  recordOn(c, "i", t("hist.linkResent", { amount: fmt(owed) }), t("hist.to", { mobile: pt(w, c).mobile }),
    { type: "LINK", amount: owed, mode: "Payment link", resend: true });
  fx.toast("", t("toast.linkResent"), name(w, c));
}

/* The payment is what creates the invoice — one event, one history line (v3 payAll, line 1686). */
export function payAll(w: World, c: Visit, via: string, fx: Fx, detail?: string, parts?: PayPart[]) {
  const b = c.bill;
  if (!b) return null;
  const lines = [c.consult, ...c.orders].filter((l) => b.codes.includes(l.code));
  const creditPart = round2((parts || []).filter((p) => p.mode === "Credit").reduce((a, p) => a + p.amount, 0));
  const paid = via === "Credit" ? false : creditPart <= 0.004; /* part credit is not paid in full */
  const paidPart = round2(b.patient - (via === "Credit" ? b.patient : creditPart));
  const inv: Invoice = {
    id: newInvoiceId(), scope: b.scope, at: now(),
    patient: b.patient, company: b.company, deductible: b.deductible,
    paid, via, viaDetail: detail || "",
    payments: parts ? parts.map((p) => ({ mode: p.mode, amount: p.amount, ref: [p.ref2, p.ref].filter(Boolean).join(" · ") })) : null,
    payer: b.payerLabel || payerOf(w, c).label, rows: b.rows,
    branch: c.interbranch ? c.fromBranch : null,
    replaces: b.replacing ? b.replacing.ids.slice() : null,
    credited: b.replacing ? b.replacing.credited : 0,
    cashOnly: !!b.cashOnly,
    billType: b.cashOnly ? "cash" : b.billType || billingType(w, c),
  };
  c.invoices.unshift(inv);
  if (b.replacing) b.replacing.ids.forEach((id) => {
    const old = c.invoices.find((i) => i.id === id);
    if (old) old.replaced = { at: now(), by: USER, newId: inv.id, to: billingType(w, c) };
  });
  lines.forEach((l) => { l.paid = paid; l.via = via; l.invoiceId = inv.id; });
  c.dedUsed = round2((c.dedUsed || 0) + b.deductible); /* the pool is consumed on payment */
  const wal = walletOf(w, c);
  const scopeWord = t(b.scope === "consult" ? "ledger.consultation" : "ledger.orders");
  /* each advance part draws on its own pot — OPEN, DOCTOR and CLINIC are separate purses */
  const advParts = (parts || []).filter((p) => payMode(p.mode).advance);
  if (advParts.length) {
    const drawn: string[] = [];
    advParts.forEach((p) => {
      const k = payMode(p.mode).advance!;
      const take = Math.min(wal.advance[k], p.amount);
      wal.advance[k] = round2(wal.advance[k] - take);
      drawn.push(`${fmt(take)} ${k.toLowerCase()}`);
    });
    logLedgerOn(w, c.mrn, { type: "ADV_USED", amount: round2(advParts.reduce((a, p) => a + p.amount, 0)), invoiceId: inv.id, visitId: c.id,
      note: t("ledger.applied", { scope: scopeWord, drawn: drawn.join(" + ") }) });
  } else if (via === "Advance") { /* the old single-mode route, still used by fixtures */
    let rem = b.patient;
    const drawn: string[] = [];
    ADV_CATS.forEach((k) => {
      const take = Math.min(wal.advance[k], rem);
      if (take > 0) drawn.push(`${fmt(take)} ${k.toLowerCase()}`);
      wal.advance[k] = round2(wal.advance[k] - take); rem = round2(rem - take);
    });
    logLedgerOn(w, c.mrn, { type: "ADV_USED", amount: b.patient, invoiceId: inv.id, visitId: c.id,
      note: t("ledger.applied", { scope: scopeWord, drawn: drawn.join(" + ") }) });
  }
  const creditRaised = via === "Credit" ? b.patient : creditPart;
  if (creditRaised > 0.004) logLedgerOn(w, c.mrn, { type: "CREDIT_RAISED", amount: creditRaised, invoiceId: inv.id, visitId: c.id,
    note: t("ledger.unsettled", { scope: t(b.scope === "consult" ? "hist.label.consult" : "hist.label.orders"),
      paid: paidPart > 0.004 ? t("ledger.paidAtDesk", { amount: fmt(paidPart) }) : "" }) });
  const label = billLabel(c);
  if (b.replacing) {
    const rp = b.replacing, to = rp.to, dif = b.due || 0, ids = rp.ids.join(", ");
    recordOn(c, "", t("hist.replaced", { ids, inv: inv.id }),
      t("hist.replacedSub", {
        main: rp.partial ? (to === "cash" ? t("hist.replacedPartCash", { payer: payerOf(w, c).label }) : t("hist.replacedPartIns", { payer: payerOf(w, c).label }))
          : t(to === "cash" ? "hist.replacedWholeCash" : "hist.replacedWholeIns", { to }),
        credited: fmt(rp.credited),
        settle: dif > 0.004 ? t("hist.replacedCollected", { amount: fmt(dif), via }) : dif < -0.004 ? t("hist.replacedRefunded", { amount: fmt(-dif) }) : t("hist.replaceSettled"),
      }),
      { type: "REPLACE", invoiceId: inv.id, amount: b.patient, replaced: rp.ids, credited: rp.credited, diff: b.due, mode: via, scope: b.scope,
        lines: b.rows.map((r) => ({ name: r.name, code: r.code, ins: "notcovered", price: r.calc.gross })) });
    if (dif >= -0.004) markDone(c, "replace", t("replace.done", { ids, inv: inv.id }),
      dif > 0.004 ? t("hist.replacedCollected", { amount: fmt(dif), via }) : t("replace.noMoney"));
    fx.toast("ok", t("toast.replaced", { inv: inv.id }), t("toast.replacedSub", { name: name(w, c), to,
      settle: dif > 0.004 ? t("toast.replacedCollected", { amount: fmt(dif) }) : dif < -0.004 ? t("toast.replacedToRefund", { amount: fmt(-dif) }) : t("toast.replacedNoMoney") }));
    c.bill = null; c.link = null;
    return inv;
  }
  const onCredit = creditRaised > 0.004;
  recordOn(c, onCredit ? "w" : "",
    onCredit && paidPart > 0.004 ? t("hist.partPaid", { label, paid: fmt(paidPart), credit: fmt(creditRaised) })
      : t(onCredit ? "hist.putOnCredit" : "hist.paid", { label, amount: fmt(b.patient) }),
    t("hist.paidSub", {
      via, detail: detail ? ` · ${detail}` : "", inv: inv.id,
      company: b.company > 0 ? t("hist.toPayer", { amount: fmt(b.company), payer: payerName(w, c) }) : "",
      branch: c.interbranch ? t("hist.performedAt", { branch: c.fromBranch }) : "",
    }),
    { type: "PAYMENT", invoiceId: inv.id, amount: b.patient, company: b.company, deductible: b.deductible, mode: via, ref: detail || "", scope: b.scope });
  fx.toast("ok",
    onCredit ? (paidPart > 0.004 ? t("toast.partPaid", { paid: fmt(paidPart), credit: fmt(creditRaised) }) : t("toast.onCredit", { amount: fmt(b.patient) }))
      : t("toast.paymentReceived", { amount: fmt(b.patient) }),
    `${name(w, c)} · ${inv.id}`);
  /* a paid package opens up its procedures for booking */
  const pkgRows = (inv.rows || []).filter((r) => r.package && r.children && r.children.length);
  if (pkgRows.length && paid) {
    const n = pkgRows.reduce((a, r) => a + r.children!.length, 0);
    const names = pkgRows.map((r) => r.name).join(", ");
    recordOn(c, "i", t("hist.pkgReady", { count: n }), t("hist.pkgReadySub", { names, inv: inv.id }),
      { type: "PKGREADY", invoiceId: inv.id, lines: pkgRows.flatMap((r) => r.children!.map((k) => ({ name: k.name, code: k.code, ins: "notcovered", price: 0 }))) });
    fx.toast("", t("toast.pkgReady", { count: n }), `${name(w, c)} · ${names}`);
  }
  c.bill = null; c.link = null;
  return inv;
}

/* the doctor opening the consultation is what moves the visit on — it answers on the second check */
export function checkDoctor(w: World, c: Visit, fx: Fx) {
  c.docChecks = (c.docChecks || 0) + 1;
  if (c.docChecks < 2) {
    c.lastDocCheck = now();
    recordOn(c, "w", t("hist.docNotStarted"), t("hist.waitingToBeSeen", { name: name(w, c) }), { type: "CHECK", by: USER });
    fx.toast("warn", t("toast.notStarted"), t("toast.notStartedSub", { name: name(w, c) }));
    return;
  }
  c.docChecks = 0; c.lastDocCheck = null;
  c.clinical = { at: now() };
  c.activeStory = "orders"; /* the visit story is done; orders take over */
  const first = c.doctor.split(" ")[0]!;
  recordOn(c, "i", t("hist.docStarted", { doctor: first.charAt(0) + first.slice(1).toLowerCase() }), t("hist.withDoctor", { name: name(w, c) }),
    { type: "CLINICAL", by: "Dr " + c.doctor });
  fx.toast("ok", t("toast.withDoctor"), t("toast.withDoctorSub", { name: name(w, c) }));
}

/* v3 markLwbs() / undoLwbs() (lines 1827–1840): the patient left before the doctor started */
export function markLwbs(w: World, c: Visit, reason: string, fx: Fx) {
  c.lwbs = { at: now(), by: USER, reason };
  recordOn(c, "w", t("hist.lwbs"), t("hist.lwbsSub", { reason: reason || t("hist.lwbsNoReason") }), { type: "LWBS", by: USER, reason });
  fx.toast("warn", t("toast.lwbs"), t("toast.lwbsSub", { name: name(w, c) }));
}
export function undoLwbs(_w: World, c: Visit) {
  const was = c.lwbs;
  if (!was) return;
  delete c.lwbs;
  recordOn(c, "i", t("hist.lwbsCleared"), t("hist.lwbsClearedSub", { at: was.at, now: now() }), { type: "LWBS", by: USER });
}

export function checkOrders(w: World, c: Visit, fx: Fx) {
  const again = c.orders.length > 0;
  c.orderChecks = (c.orderChecks || 0) + 1;
  if (c.orderChecks < 2) {
    c.lastOrderCheck = now();
    fx.toast("warn", t(again ? "toast.noNewOrders" : "toast.noOrders"),
      t(again ? "toast.noNewOrdersSub" : "toast.noOrdersSub", { doctor: c.doctor, name: name(w, c) }));
    return;
  }
  c.orderChecks = 0; c.lastOrderCheck = null;
  simOrders(w, c, fx);
}

/* The receptionist can bill a subset: unticking a line takes it out of this invoice (it stays on the visit). */
export function toggleLine(w: World, c: Visit, code: string, lines: Line[], fx: Fx) {
  c.sel = c.sel || {};
  const nowOn = c.sel[code] === false;
  if (!nowOn && selectedLines(c, lines).length <= 1) {
    fx.toast("warn", t("toast.oneLine"), t("toast.oneLineSub"));
    return;
  }
  c.sel[code] = nowOn;
  /* a charge already prepared is re-priced on the spot */
  if (c.bill && !c.bill.replacing) {
    const bill = c.bill;
    const keep = selectedLines(c, lines).filter((l) => bill.codes.includes(l.code) || lines.includes(l));
    startBill(w, c, bill.scope, keep);
    c.link = null;
  }
}

/* ORDERS_MIXED "Wait for all approvals" and ORDERS_WAIT "Bill the N approved order(s) now" (v3 lines 3135, 3170) */
export function waitAll(_w: World, c: Visit) {
  const appr = approvedOrders(c);
  c.prefs.waitAll = true;
  recordOn(c, "i", t("hist.holding"), t("hist.holdingSub", { count: appr.length }),
    { type: "HOLD", lines: histLines(c.orders.filter((o) => !o.paid)) });
}
export function releaseHeld(w: World, c: Visit, fx: Fx) {
  const appr = approvedOrders(c), pend = pendingOrders(c);
  c.prefs.waitAll = false;
  recordOn(c, "i", t("hist.released"), t("hist.releasedSub", { count: appr.length, pend: pend.length }), { type: "HOLD", lines: histLines(appr) });
  fx.toast("", t("toast.released", { count: appr.length }), name(w, c));
}

/* ---- stories (v3 lines 2043–2054) ---- */
export function settleDone(w: World, c: Visit, id: string) {
  if (c.storyDone && c.storyDone[id] && storyHasWork(w, c, id as StoryId)) delete c.storyDone[id];
}
export function switchStory(w: World, c: Visit, id: StoryId, current: StoryId, fx: Fx) {
  const why = storyLock(c, id);
  if (why) { fx.toast("warn", t("toast.notNow"), t(why.k)); return; }
  if (current !== id) { settleDone(w, c, current); settleDone(w, c, id); }
  c.activeStory = id;
  c.visitPinned = id === "visit";
  c.seen = { ...(c.seen || {}), [id]: true };
}
/* v3 openVisit(): a visit always opens on its main story */
export function openedVisit(w: World, c: Visit) {
  c.activeStory = null; c.visitPinned = false;
  Object.keys(c.storyDone || {}).forEach((k) => settleDone(w, c, k));
}
export const backToMain = (w: World, c: Visit, fx: Fx) => switchStory(w, c, mainStory(w, c), mainStory(w, c), fx);

/* ---- the simulated world (v3 lines 3314–3387) ---- */
export function simApproveConsult(w: World, c: Visit, fx: Fx) {
  if (!isPending(c.consult)) { fx.toast("", t("toast.nothingToCheck"), t("toast.nothingToCheckSub")); return; }
  c.consult.ins = "approved";
  recordOn(c, "i", t("hist.consultApproved"), t("hist.approvedInFull", { payer: payerName(w, c) }),
    { type: "APPROVAL", by: payerName(w, c), lines: [{ name: c.consult.name, code: c.consult.code, ins: "approved" }] });
  fx.toast("ok", t("toast.approvalReceived"), t("toast.consultCanBill", { name: name(w, c) }));
}

export function simOrders(w: World, c: Visit, fx: Fx) {
  const insured = !!planOf(w, c);
  const round = (c.orderRounds || 0) + 1;
  c.orderRounds = round;
  let batch: Line[];
  if (round === 1) {
    batch = [
      { code: "LAB-022", name: "Urea & Electrolytes", price: 140, ins: insured ? "approved" : "notinsured", ordered: now(), paid: false },
      { code: "RAD-018", name: "Abdominal Ultrasound", price: 420, ins: insured ? "partial" : "notinsured", ordered: now(), paid: false },
      { code: "LAB-440", name: "Thyroid Panel", price: 260, ins: insured ? "pending" : "notinsured", ordered: now(), paid: false },
    ];
  } else {
    const src = LATER_ORDERS[(round - 2) % LATER_ORDERS.length]!;
    batch = src.map((o) => ({ code: o.code, name: o.name, price: o.price, ins: insured ? o.kind : ("notinsured" as const), ordered: now(), paid: false }))
      .filter((o) => !c.orders.some((x) => x.code === o.code));
    if (!batch.length) { fx.toast("", t("toast.nothingNew"), t("toast.nothingNewSub", { name: name(w, c) })); return; }
  }
  c.orders.push(...batch);
  recordOn(c, "i",
    t("hist.ordersPlaced", { doctor: c.doctor.split(" ")[0], count: batch.length, more: round > 1 ? t("hist.more") : "" }),
    insured ? t("hist.ordersPlacedSub", { appr: batch.filter((o) => o.ins !== "pending").length, pend: batch.filter((o) => o.ins === "pending").length })
      : t("hist.ordersSelfPay"),
    { type: "ORDERS", by: "Dr " + c.doctor, lines: histLines(batch) });
  fx.toast("", t(round > 1 ? "toast.moreOrders" : "toast.ordersPlaced"), t("toast.procedures", { name: name(w, c), count: batch.length }));
}

/* The receptionist checks the payer. The first check comes back empty; the next brings the approval. */
export function checkApproval(w: World, c: Visit, fx: Fx) {
  const pend = [...pendingOrders(c), ...cashHeld(c)];
  if (!pend.length) { fx.toast("", t("toast.nothingPending"), name(w, c)); return; }
  c.checks = (c.checks || 0) + 1;
  if (c.checks < 2) {
    c.lastCheck = now();
    recordOn(c, "w", t("hist.approvalChecked"), t("hist.approvalCheckedSub", { payer: payerName(w, c), count: pend.length }),
      { type: "CHECK", by: USER, lines: histLines(pend) });
    fx.toast("warn", t("toast.approvalNotYet"), t("toast.approvalNotYetSub", { payer: payerName(w, c), count: pend.length }));
    return;
  }
  c.checks = 0; c.lastCheck = null;
  simApproval(w, c, fx);
}
export function simApproval(w: World, c: Visit, fx: Fx) {
  const held = cashHeld(c);
  const p = [...pendingOrders(c), ...held];
  if (!p.length) { fx.toast("", t("toast.nothingPending"), name(w, c)); return; }
  pendingOrders(c).forEach((o) => { o.ins = "approved"; });
  /* a cash-billed order keeps its cash invoice until it is actually replaced */
  held.forEach((o) => { o.approvalPending = false; o.approvalGranted = "approved"; });
  recordOn(c, "i", t("hist.ordersApproved", { count: p.length }),
    `${p.map((o) => o.name).join(", ")}${held.length ? t("hist.heldAsCash", { count: held.length }) : ""}`,
    { type: "APPROVAL", by: payerName(w, c), lines: histLines(p, "approved") });
  c.prefs.waitAll = false; /* everything is approved now, so bill it together */
  fx.toast("ok", t("toast.ordersApproved", { count: p.length }), t("toast.readyToBill", { name: name(w, c) }));
}
export function simPaid(w: World, c: Visit, fx: Fx) { if (c.link) payAll(w, c, "Payment link", fx); }
export function simStale(_w: World, c: Visit) { if (c.link) c.link.ageMin = 14; }

/* v3 addComment() toast and the pin toggle in renderHistory() (lines 4359–4404) */
export function togglePin(_w: World, c: Visit, i: number, fx: Fx) {
  const h = c.history[i];
  if (!h) return;
  h.important = !h.important;
  h.pinnedBy = USER; h.pinnedAt = now();
  fx.toast("", t(h.important ? "toast.pinned" : "toast.unpinned"), h.tx.replace(/<[^>]+>/g, "").slice(0, 60));
}
