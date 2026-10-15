import { now } from "../domain/clock";
import { USER } from "../domain/constants";
import { newRefundId } from "../domain/ids";
import { refundedOf } from "../domain/lines";
import { payerOf, pt } from "../domain/lookup";
import { fmt, round2 } from "../domain/money";
import type { Invoice, InvoiceRow, Visit, World } from "../domain/types";
import { markDone, t, type Fx } from "./actions";
import { logLedgerOn, recordOn } from "./world";

/* Refunds (v3 lines 4452–4458, 5192–5327). A refund always happens in its visit's Refund story. */

/* v3 openRefund(), the visit's side: the Refund story takes over, fresh */
export function openRefundOn(_w: World, c: Visit) {
  c.activeStory = "refund";
  c.seen = { ...(c.seen || {}), refund: true };
  if (c.storyDone) delete c.storyDone.refund;
}

/* v3 raiseRefundInvoice() (line 4452): every refund raises a refund invoice (credit note) with its own number,
   kept apart from the visit's invoices so collected totals, billing and claims are not disturbed */
export function raiseRefundInvoice(w: World, c: Visit, inv: Invoice, rows: InvoiceRow[], amt: number, company: number, dedBack: number,
  mode: string, reason: string, detail: string): Invoice {
  const rinv: Invoice = {
    id: newRefundId(), kind: "refund", refOf: inv.id, at: now(), scope: inv.scope, patient: round2(amt), company: round2(company || 0),
    deductible: round2(dedBack || 0), paid: false /* unset in v3: money went out, not in */, via: mode, viaDetail: detail || "", reason, payer: inv.payer || payerOf(w, c).label, by: USER,
    rows: rows.map((r) => ({ name: r.name, code: r.code, calc: r.calc })),
  };
  (c.refundInvoices = c.refundInvoices || []).push(rinv);
  return rinv;
}

/* v3 completeRefund() (line 5302) */
export function completeRefund(w: World, c: Visit, invId: string, codes: string[], amt: number, dedBack: number,
  mode: string, reason: string, detail: string, fx: Fx) {
  const inv = c.invoices.find((i) => i.id === invId);
  if (!inv) return;
  const chosen = inv.rows.filter((r) => codes.includes(r.code));
  chosen.forEach((r) => { r.refunded = true; });
  inv.refundedTotal = round2(refundedOf(inv) + amt);
  inv.refunds = inv.refunds || [];
  const rinv = raiseRefundInvoice(w, c, inv, chosen, amt, chosen.reduce((a, r) => a + r.calc.companyWithTax, 0), dedBack, mode, reason, detail);
  inv.refunds.push({ at: now(), amount: amt, mode, reason, by: USER, detail: detail || "", codes: chosen.map((r) => r.code), refundInvoiceId: rinv.id });
  /* the lines are no longer billable, and the deductible they consumed comes back */
  [c.consult, ...c.orders].filter((l) => chosen.some((r) => r.code === l.code)).forEach((l) => { l.refunded = true; });
  c.dedUsed = Math.max(0, round2((c.dedUsed || 0) - dedBack));
  if (mode === "Advance wallet") {
    const wal = w.patients[c.mrn]!.wallet;
    wal.advance.Open = round2(wal.advance.Open + amt);
    logLedgerOn(w, c.mrn, { type: "REFUND_IN", amount: amt, cat: "Open", invoiceId: inv.id, visitId: c.id, note: t("ledger.refundIn", { reason }) });
  }
  const names = chosen.map((r) => r.name).join(", ");
  recordOn(c, "w", t("hist.refunded", { amount: fmt(amt), inv: inv.id }),
    t("hist.refundedSub", { rinv: rinv.id, names, mode, detail: detail ? ` · ${detail}` : "", reason }),
    { type: "REFUND", invoiceId: inv.id, refundInvoiceId: rinv.id, amount: amt, mode, ref: detail || "", reason,
      lines: chosen.map((r) => ({ name: r.name, code: r.code, ins: "notcovered", price: r.calc.gross })) });
  markDone(c, "refund", t("refund.done", { amount: fmt(amt), inv: inv.id }), t("refund.doneSub", { rinv: rinv.id, names, mode, reason }));
  c.storyDone!.refund!.refundInvoiceId = rinv.id;
  fx.toast("warn", t("toast.refunded", { amount: fmt(amt) }), t("toast.refundedSub", { name: pt(w, c).name, inv: inv.id, mode }));
  return rinv;
}
