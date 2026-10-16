import { liveInvoices, refundedOf } from "./lines";
import { planOf, pt } from "./lookup";
import { round2 } from "./money";
import { calcLine, cashPriceOf, insPriceOf } from "./pricing";
import type { Calc, Invoice, InsStatus, Line, Plan, Visit, World } from "./types";

/* Replacing billing (v3 lines 1339–1383, 1461–1536). The patient type is decided when the visit starts. An
   insurance patient stays an insurance patient: replacing to cash re-prices only the invoiced orders at cash,
   and the consultation stays on the policy. A cash patient can be moved onto a policy, and then the whole
   visit moves so invoicing carries on with approvals. */
export function billedLines(c: Visit) {
  const ids = liveInvoices(c).map((i) => i.id);
  return [c.consult, ...c.orders].filter((l) => l.invoiceId && ids.includes(l.invoiceId));
}
export const billingType = (w: World, c: Visit) => (planOf(w, c) ? "insurance" : "cash");
export type ReplaceTo = "cash" | "insurance";
export function replaceLinesFor(c: Visit, to: ReplaceTo) {
  /* insurance → cash: the invoiced orders still on the policy, never the consultation */
  if (to === "cash") return billedLines(c).filter((l) => l !== c.consult && !l.urgentCash);
  /* cash → insurance: everything invoiced on the visit */
  return billedLines(c);
}
export interface ReplaceRow { line: Line; price: number; ins: InsStatus; calc: Calc; was: number; approval: InsStatus | null }
export function replacePreview(w: World, c: Visit, to: ReplaceTo, payerId: string, only?: Line[] | null) {
  const lines = only || replaceLinesFor(c, to);
  /* only the invoices these lines sit on are touched, and whole invoices at a time */
  const touched = liveInvoices(c).filter((i) => lines.some((l) => l.invoiceId === i.id));
  const all = [c.consult, ...c.orders];
  const set = [...lines];
  touched.forEach((i) => (i.rows || []).forEach((r) => {
    const l = all.find((x) => x.code === r.code);
    if (l && !set.includes(l)) set.push(l);
  }));
  const plan: Plan | null = to === "insurance" ? (pt(w, c).payers.find((p) => p.id === payerId) || { plan: null }).plan : null;
  /* the pool already given to the invoices that are staying put */
  const keptDed = round2(liveInvoices(c).filter((i) => !touched.includes(i)).reduce((a, i) => a + (i.deductible || 0), 0));
  let left = plan ? Math.max(0, Math.min(plan.visitCap, plan.annualLeft) - keptDed) : 0;
  const rows: ReplaceRow[] = set.map((l) => {
    const price = to === "cash" ? cashPriceOf(l) : insPriceOf(l);
    const st = to === "cash" ? null : approvalOf(c, l, payerId);
    const ins: InsStatus = to === "cash" ? "notinsured" : isApproved(st) ? st! : "pending";
    const calc = calcLine({ ...l, price, ins }, Math.max(0, left), plan);
    left = round2(left - calc.deductible);
    return { line: l, price, ins, calc, was: round2(l.price), approval: st };
  });
  const newTotal = round2(rows.reduce((a, r) => a + r.calc.patientWithTax, 0));
  const oldPaid = round2(touched.reduce((a, i) => a + i.patient - refundedOf(i), 0));
  const missing = to === "insurance" ? rows.filter((r) => !isApproved(r.approval)) : [];
  return { rows, plan, newTotal, oldPaid, keptDed, partial: !!only, missing, diff: round2(newTotal - oldPaid), ids: touched.map((i) => i.id) };
}

/* what a given insurer has said about a line */
export function approvalOf(c: Visit, l: Line, payerId: string): InsStatus | null {
  if (l.appr && l.appr[payerId]) return l.appr[payerId]!;
  if (payerId === c.payerId) {
    if (l.approvalGranted) return l.approvalGranted;
    if (l.approvalPending) return "pending";
    if (l.ins === "approved" || l.ins === "partial") return l.ins;
  }
  return null;
}
export const isApproved = (st: InsStatus | null | undefined) => st === "approved" || st === "partial";

/* whether an invoice can be replaced, and onto which payer (v3 returns an `open` closure too — the
   store builds that action from `payerId`) */
export function invoiceReplace(w: World, c: Visit, inv: Invoice): { ok: boolean; reason: string; payerId: string } | null {
  if (inv.voided || inv.replaced || inv.packagePrint) return null;
  const lines = [c.consult, ...c.orders].filter((l) => l.invoiceId === inv.id);
  if (!lines.length) return null;
  if (planOf(w, c)) {
    if (!lines.every((l) => l.urgentCash)) return null; /* only orders billed as cash */
    const ok = lines.every((l) => isApproved(approvalOf(c, l, c.payerId)));
    return { ok, reason: ok ? "" : "approval outstanding", payerId: c.payerId };
  }
  const insurers = pt(w, c).payers.filter((p) => p.plan);
  if (!insurers.length) return null;
  /* this invoice only — defaulting to the insurer that has approved most of its lines */
  const best = insurers
    .map((p) => ({ p, n: lines.filter((l) => isApproved(approvalOf(c, l, p.id))).length }))
    .sort((a, b) => b.n - a.n)[0]!.p;
  return { ok: true, reason: "", payerId: best.id };
}

/* a package is billed once; its child procedures are booked as their own nil-priced visits */
export interface PkgItem { c: Visit; inv: Invoice; parent: Invoice["rows"][number]; child: NonNullable<Line["children"]>[number]; doneOn: Visit | null }
export function packageItems(w: World, mrn: string) {
  const out: PkgItem[] = [];
  w.cases.filter((x) => x.mrn === mrn).forEach((c) => c.invoices.forEach((inv) => {
    if (!inv.paid) return;
    (inv.rows || []).forEach((r) => {
      if (!r.package || !r.children) return;
      r.children.forEach((ch) => out.push({ c, inv, parent: r, child: ch, doneOn: ch.visitId ? w.cases.find((v) => v.id === ch.visitId) || null : null }));
    });
  }));
  return out;
}
export const packageItemsLeft = (w: World, mrn: string) => packageItems(w, mrn).filter((x) => !x.child.visitId);
