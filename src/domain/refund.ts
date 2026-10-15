import { lineRefundable } from "./lines";
import { findInvoice } from "./lookup";
import { round2 } from "./money";
import type { Invoice, Visit, World } from "./types";

/* the refund being worked in a visit's Refund story (v3 state.refund) */
export interface RefundUi { id: string; sel: Record<string, boolean>; reason: string; linesOpen: boolean }

/* v3 openRefund() (line 5192): everything not yet performed starts ticked */
export function refundStart(w: World, id: string): RefundUi | null {
  const hit = findInvoice(w, id);
  if (!hit || (hit.inv as { kind?: string }).kind) return null;
  const inv = hit.inv as Invoice, sel: Record<string, boolean> = {};
  inv.rows.forEach((r) => { if (lineRefundable(w, inv, r)) sel[r.code] = true; });
  return { id, sel, reason: "", linesOpen: false };
}

/* v3 refundCalc() (line 5205): what goes back — the patient share, the payer share reversed, the deductible released */
export function refundCalc(w: World, d: RefundUi) {
  const hit = findInvoice(w, d.id);
  if (!hit) return null;
  const c: Visit = hit.c, inv = hit.inv as Invoice;
  const chosen = inv.rows.filter((r) => d.sel[r.code] && lineRefundable(w, inv, r));
  const amt = round2(chosen.reduce((a, r) => a + r.calc.patientWithTax, 0));
  const payerBack = round2(chosen.reduce((a, r) => a + r.calc.companyWithTax, 0));
  const dedBack = round2(chosen.reduce((a, r) => a + r.calc.deductible, 0));
  const open = inv.rows.filter((x) => lineRefundable(w, inv, x)).length;
  return { c, inv, chosen, amt, payerBack, dedBack, open, ok: amt > 0 && d.reason.trim().length > 2 };
}
