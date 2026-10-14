import { findInvoice } from "./lookup";
import { isPending } from "./pricing";
import { round2 } from "./money";
import type { Invoice, InvoiceRow, Line, Visit, WalletDoc, World } from "./types";

/* v3 lines 942, 1277–1291, 1313–1337: what is billed, due, collected, on credit */
export const procOnly = (c: Visit) => c.visitType === "Procedure only";

/* a line is "on the bill" while it is waiting to be paid — no invoice exists yet */
export const onBill = (c: Visit, l: Line) => !!(c.bill && c.bill.codes.includes(l.code));
/* invoiced is invoiced — credit means billed but unsettled, never "bill it again" */
export const billedAlready = (c: Visit, l: Line) => !!l.invoiceId || onBill(c, l);
export const doctorOrders = (c: Visit) => c.orders.filter((o) => !o.byReception);

/* done = billed elsewhere, not applicable (package visits), already paid, or invoiced */
export const consultDone = (c: Visit) =>
  !!(c.consult.elsewhere || c.consult.notApplicable || c.consult.paid || billedAlready(c, c.consult));

/* orders open once the visit is invoiced and the doctor has started (or has already ordered) */
export const ordersOpen = (c: Visit) =>
  !c.lwbs && consultDone(c) && (!!c.clinical || doctorOrders(c).length > 0 || !!c.interbranch || procOnly(c));

/* an order added at reception is billed once orders open — it never skips the doctor on a consultation */
export const inPlay = (c: Visit, o: Line) => !o.byReception || ordersOpen(c);
export const approvedOrders = (c: Visit) => c.orders.filter((o) => !billedAlready(c, o) && !isPending(o) && inPlay(c, o));
export const pendingOrders = (c: Visit) => c.orders.filter((o) => !billedAlready(c, o) && isPending(o) && inPlay(c, o));
/* An order that cannot wait for its approval: billed at the cash price, moved onto the policy later */
export const cashHeld = (c: Visit) => c.orders.filter((o) => o.urgentCash && o.approvalPending);

/* the invoice is only created when the money arrives, so "due" is the open charge;
   on a replacement only the difference changes hands */
export const due = (c: Visit) => (c.bill ? (c.bill.due != null ? c.bill.due : c.bill.patient) : 0);

export const refundedOf = (inv: Pick<Invoice, "refundedTotal">) => round2(inv.refundedTotal || 0);

/* how much of an invoice was left on credit — a payment can be part cash, part credit */
export function creditOf(inv: Invoice | WalletDoc) {
  const i = inv as Invoice;
  if (i.settled || i.voided || i.replaced) return 0;
  if (i.payments && i.payments.length) return round2(i.payments.filter((p) => p.mode === "Credit").reduce((a, p) => a + p.amount, 0));
  return i.via === "Credit" ? i.patient : 0;
}
export const onCreditInv = (inv: Invoice) => creditOf(inv) > 0.004;
export const paidOf = (inv: Invoice) => round2(inv.patient - creditOf(inv));
export const visitCredit = (c: Visit) => c.invoices.filter(onCreditInv);
export const visitCreditTot = (c: Visit) => round2(visitCredit(c).reduce((a, i) => a + creditOf(i), 0));

/* what actually came in: the credit part of an invoice is not money collected */
export const collected = (c: Visit) =>
  round2(c.invoices.filter((i) => !i.voided && !i.replaced).reduce((a, i) => a + (i.settled ? i.patient : paidOf(i)) - refundedOf(i), 0));

/* credit is not a loose number — it is the invoices left unsettled, across every visit */
export function creditInvoices(w: World, mrn: string) {
  const out: { c: Visit; inv: Invoice }[] = [];
  w.cases.filter((x) => x.mrn === mrn).forEach((x) => x.invoices.forEach((inv) => {
    if (onCreditInv(inv)) out.push({ c: x, inv });
  }));
  return out.sort((a, b) => (a.inv.at || "").localeCompare(b.inv.at || ""));
}
export const creditTotal = (w: World, mrn: string) => round2(creditInvoices(w, mrn).reduce((a, x) => a + creditOf(x.inv), 0));

export const liveInvoices = (c: Visit) => c.invoices.filter((i) => !i.voided && !i.replaced && !i.packagePrint);

/* v3 lines 5234–5239 */
export function performedOf(c: Visit, code: string): string | null {
  if (c.consult && c.consult.code === code)
    return c.lwbs ? null : c.clinical ? c.clinical.at : doctorOrders(c).length || c.closed ? "seen" : null;
  const o = c.orders.find((x) => x.code === code);
  return o ? o.performed || null : null;
}

/* a line can be refunded only while it has not been performed and its company share has not been claimed
   (v3 lines 1294–1307) */
export function lineRefundable(w: World, inv: Invoice, r: InvoiceRow) {
  if (r.refunded || inv.claimed) return false;
  const h = findInvoice(w, inv.id);
  return !(h && performedOf(h.c, r.code));
}
export const refundable = (w: World, inv: Invoice) =>
  !inv.voided && !inv.replaced && paidOf(inv) > 0.01 && refundedOf(inv) < paidOf(inv) - 0.01 &&
  inv.rows.some((r) => lineRefundable(w, inv, r));
export function refundState(inv: Invoice) {
  if (inv.replaced) return "Replaced";
  if (inv.voided) return "Void";
  const r = refundedOf(inv);
  if (r <= 0) return "";
  return r >= inv.patient - 0.01 ? "Refunded" : "Partially refunded";
}
export function refundableInvoices(w: World, mrn: string) {
  const out: { c: Visit; inv: Invoice }[] = [];
  w.cases.filter((x) => x.mrn === mrn).forEach((x) => x.invoices.forEach((inv) => {
    if (refundable(w, inv)) out.push({ c: x, inv });
  }));
  return out;
}

/* v3 lines 1882–1885: every candidate line starts ticked */
export const selectedLines = (c: Visit, lines: Line[]) => lines.filter((l) => (c.sel || {})[l.code] !== false);
