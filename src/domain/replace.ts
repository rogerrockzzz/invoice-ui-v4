import { planOf, pt } from "./lookup";
import type { Invoice, InsStatus, Line, Visit, World } from "./types";

/* Predicates only — the Replace story itself is M2. v3 lines 1349, 1464–1473, 1499–1536. */
export const billingType = (w: World, c: Visit) => (planOf(w, c) ? "insurance" : "cash");

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
export function packageItems(w: World, mrn: string) {
  const out: { c: Visit; inv: Invoice; parent: Invoice["rows"][number]; child: NonNullable<Line["children"]>[number]; doneOn: Visit | null }[] = [];
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
