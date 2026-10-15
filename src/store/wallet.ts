import { ADV_CATS } from "../domain/constants";
import { now } from "../domain/clock";
import { creditInvoices, creditOf } from "../domain/lines";
import { findInvoice, pt, visitsOf } from "../domain/lookup";
import { fmt, round2 } from "../domain/money";
import type { AdvCat, Visit, World } from "../domain/types";
import { markDone, t, type Fx } from "./actions";
import { logLedgerOn, recordOn } from "./world";

/* The wallet's stories (v3 lines 4171–4352, 2970–3021, 5821–5866, 1801, 4854): add advance, refund advance,
   settle credit — and reprinting a document. Each returns what the wallet section shows when it is done. */
export interface WalletDone { story: "advadd" | "advrefund" | "credit"; title: string; sub: string }

/* the visit a patient-level movement is written to: the one it was opened from, else the newest */
const targetOf = (w: World, mrn: string, caseId: number | null) => (caseId != null && w.cases.find((x) => x.id === caseId)) || visitsOf(w, mrn)[0];

/* v3 renderAdvanceDrawer() #aGo (line 4338) */
export function addAdvance(w: World, mrn: string, caseId: number | null, cat: AdvCat, mode: string, amt: number, fx: Fx): WalletDone {
  const p = w.patients[mrn]!, wal = p.wallet;
  wal.advance[cat] = round2(wal.advance[cat] + amt);
  const target = targetOf(w, mrn, caseId);
  if (target) recordOn(target, "i", t("hist.advAdded", { amount: fmt(amt) }), t("hist.advAddedSub", { cat, mode }), { type: "ADVANCE", amount: amt, mode, cat });
  logLedgerOn(w, mrn, { type: "ADV_IN", amount: amt, cat, mode, visitId: target ? target.id : null, note: t("ledger.advReceived", { cat }) });
  fx.toast("ok", t("toast.advAdded", { amount: fmt(amt) }), `${p.name} · ${cat}`);
  return { story: "advadd", title: t("wallet.done.added", { amount: fmt(amt) }), sub: t("wallet.done.addedSub", { cat, mode, now: fmt(wal.advance[cat]) }) };
}

/* v3 renderDrawer() d.advRefund branch (line 5821): unused advance back to the patient */
export function refundAdvance(w: World, mrn: string, caseId: number | null, pot: AdvCat, amount: number, mode: string, reason: string, detail: string, fx: Fx): WalletDone {
  const p = w.patients[mrn]!, ww = p.wallet;
  ww.advance[pot] = round2(ww.advance[pot] - amount);
  const target = targetOf(w, mrn, caseId);
  const d = detail ? ` · ${detail}` : "";
  logLedgerOn(w, mrn, { type: "ADV_REFUND", amount, cat: pot, mode, visitId: target ? target.id : null, note: t("ledger.advRefunded", { cat: pot, reason, detail: d }) });
  if (target) recordOn(target, "w", t("hist.advRefunded", { amount: fmt(amount) }), t("hist.advRefundedSub", { cat: pot, mode, detail: d, reason }),
    { type: "ADVREFUND", amount, mode, cat: pot, reason });
  fx.toast("warn", t("toast.advRefunded", { amount: fmt(amount) }), `${p.name} · ${mode}`);
  return { story: "advrefund", title: t("wallet.done.refunded", { amount: fmt(amount) }), sub: t("wallet.done.refundedSub", { cat: pot, mode, now: fmt(ww.advance[pot]) }) };
}

/* v3 renderDrawer() d.credit branch (line 5840): settling the invoices picked earlier. It is written to the visit
   the receptionist is standing on (`here`), not to whichever visit raised the credit. */
export function settleCredit(w: World, mrn: string, here: number | null, mode: string, amount: number, ids: string[] | null, detail: string, fx: Fx): WalletDone {
  const p = w.patients[mrn]!, ww = p.wallet;
  if (mode === "Advance") { /* the old single-mode route */
    let r = amount;
    ADV_CATS.forEach((k) => { const take = Math.min(ww.advance[k], r); ww.advance[k] = round2(ww.advance[k] - take); r = round2(r - take); });
  }
  const list = ids || creditInvoices(w, mrn).map((x) => x.inv.id);
  const hits = creditInvoices(w, mrn).filter((x) => list.includes(x.inv.id));
  hits.forEach((x) => { x.inv.settled = true; x.inv.paid = true; x.inv.settledVia = mode; x.inv.settledAt = now(); });
  const cc2 = w.cases.find((v) => v.id === here && v.mrn === mrn) || visitsOf(w, mrn).find((v) => !v.closed) || hits[0]!.c;
  const d = detail ? ` · ${detail}` : "";
  hits.forEach((x) => logLedgerOn(w, mrn, { type: "CREDIT_SETTLED", amount: x.inv.patient, invoiceId: x.inv.id, visitId: x.c.id, mode,
    note: t("ledger.settledBy", { mode: mode.toLowerCase(), detail: d }) }));
  if (mode === "Advance") logLedgerOn(w, mrn, { type: "ADV_USED", amount, invoiceId: list[0], visitId: cc2.id, note: t("ledger.usedToSettle", { ids: list.join(", ") }) });
  recordOn(cc2, "", t("hist.creditSettled", { amount: fmt(amount) }), t("hist.creditSettledSub", { mode, detail: d, count: list.length, ids: list.join(", ") }),
    { type: "CREDIT", amount, mode, ref: detail || "", invoiceId: list[0], invoiceIds: list,
      settled: hits.map((x) => ({ id: x.inv.id, amount: x.inv.patient, visit: `${x.c.visitType} · ${x.c.clinic} · ${x.c.date || ""}` })) });
  markDone(cc2, "credit", t("done.credit.settled", { amount: fmt(amount) }), `${mode} · ${list.join(", ")}`);
  cc2.creditSel = null;
  fx.toast("ok", t("toast.creditSettled", { amount: fmt(amount) }), t("toast.creditSettledSub", { name: p.name, count: list.length }));
  return { story: "credit", title: t("done.credit.settled", { amount: fmt(amount) }), sub: `${mode} · ${list.join(", ")}` };
}

/* v3 renderCreditStory() #ccLink (line 3004): the link goes out from the visit's Credit settlement story */
export function creditLink(w: World, c: Visit, ids: string[], fx: Fx) {
  const who = pt(w, c);
  const chosen = creditInvoices(w, c.mrn).filter((x) => ids.includes(x.inv.id));
  const amt = round2(chosen.reduce((a, x) => a + creditOf(x.inv), 0));
  const list = chosen.map((x) => x.inv.id).join(", ");
  recordOn(c, "i", t("hist.creditLink", { amount: fmt(amt) }), t("hist.creditLinkSub", { mobile: who.mobile, count: chosen.length, ids: list }),
    { type: "CREDIT", amount: amt, mode: "Payment link", invoiceId: chosen[0]!.inv.id, invoiceIds: chosen.map((x) => x.inv.id),
      settled: chosen.map((x) => ({ id: x.inv.id, amount: creditOf(x.inv), visit: `${x.c.visitType} · ${x.c.clinic} · ${x.c.date || ""}` })) });
  markDone(c, "credit", t("done.credit.link", { amount: fmt(amt) }), t("done.credit.linkSub", { mobile: who.mobile, ids: list }));
  c.creditSel = null;
  fx.toast("", t("toast.linkSentCredit"), t("toast.linkSentCreditSub", { name: who.name, amount: fmt(amt) }));
}
/* v3 renderWalletSection() #wcLink (line 4279): the same, from the wallet */
export function walletCreditLink(w: World, mrn: string, caseId: number | null, ids: string[], fx: Fx): WalletDone {
  const p = w.patients[mrn]!;
  const chosen = creditInvoices(w, mrn).filter((x) => ids.includes(x.inv.id));
  const amt = round2(chosen.reduce((a, x) => a + creditOf(x.inv), 0));
  const list = chosen.map((x) => x.inv.id).join(", ");
  const target = targetOf(w, mrn, caseId);
  if (target) recordOn(target, "i", t("hist.creditLink", { amount: fmt(amt) }), t("hist.creditLinkWalletSub", { mobile: p.mobile, ids: list }),
    { type: "CREDIT", amount: amt, mode: "Payment link", invoiceId: chosen[0]!.inv.id, invoiceIds: chosen.map((x) => x.inv.id) });
  fx.toast("", t("toast.linkSentCredit"), t("toast.linkSentCreditSub", { name: p.name, amount: fmt(amt) }));
  return { story: "credit", title: t("done.credit.link", { amount: fmt(amt) }), sub: t("done.credit.linkSub", { mobile: p.mobile, ids: list }) };
}

/* v3 openCreditPicker() (line 1801): all ticked again */
export function openCreditPicker(_w: World, c: Visit) {
  c.creditSel = null;
  if (c.storyDone) delete c.storyDone.credit;
  c.activeStory = "credit";
  c.seen = { ...(c.seen || {}), credit: true };
}
/* the credit story's ticks (v3 renderCreditStory: every invoice starts ticked) */
export function creditSel(w: World, c: Visit) {
  const list = creditInvoices(w, c.mrn);
  return c.creditSel || Object.fromEntries(list.map((x) => [x.inv.id, true]));
}
export function toggleCredit(w: World, c: Visit, id: string, on: boolean) {
  const sel = { ...creditSel(w, c) };
  if (on) sel[id] = true; else delete sel[id];
  c.creditSel = sel;
}

/* v3 reprint() (line 4854) */
export function reprint(w: World, id: string, fx: Fx) {
  const hit = findInvoice(w, id);
  if (!hit) return;
  const c = w.cases.find((x) => x.id === hit.c.id);
  if (c) recordOn(c, "i", t("hist.reprinted", { id }), t("hist.reprintedSub"), { type: "REPRINT", invoiceId: id });
  fx.toast("", t("toast.reprinted", { id }), t("toast.reprintedSub", { name: w.patients[hit.c.mrn]!.name }));
}
