import { now } from "../domain/clock";
import { USER } from "../domain/constants";
import { newInvoiceId, nextVisitId } from "../domain/ids";
import { payerOf, pt } from "../domain/lookup";
import { packageItemsLeft, type PkgItem } from "../domain/replace";
import type { Invoice, Line, PkgStory, Visit, World } from "../domain/types";
import { markDone, t, type Fx } from "./actions";
import { recordOn } from "./world";

/* Package booking and the package procedure visit (v3 lines 2907–2967, 4932–5002, 5099–5187). */

const pkgLines = (chosen: PkgItem[]) => chosen.map((x) => ({ name: x.child.name, code: x.child.code, ins: "notcovered", price: 0 }));
const names = (chosen: PkgItem[]) => chosen.map((x) => x.child.name).join(", ");

/* v3 createPkgVisit() (line 5163): the procedure gets its own visit at no charge; the child stays on its package
   invoice and is linked to the new visit. Returns the new visit's id (never a draft). */
export function createPkgVisit(w: World, d: { mrn: string; clinic: string; doctor: string }, chosen: PkgItem[], fx: Fx): number {
  const src = chosen[0]!.c, first = chosen[0]!;
  const c: Visit = {
    id: nextVisitId(), mrn: d.mrn, visitType: "Package procedure", clinic: d.clinic, doctor: d.doctor,
    arrived: now(), date: "Today", sortKey: 9100, payerId: src.payerId, dedUsed: 0,
    /* no consultation on this visit — it exists only to perform the package procedure */
    consult: { name: "Package follow-up", code: "CON-PKG", price: 0, ins: "notcovered", paid: true, notApplicable: true },
    orders: chosen.map((x) => ({ code: x.child.code, name: x.child.name, price: 0, ins: "notcovered" as const,
      ordered: now(), paid: false, fromPackage: { invoiceId: x.inv.id, parent: x.parent.name, visitId: x.c.id } })),
    invoices: [], bill: null, link: null, closed: false, prefs: {}, fromPackage: true,
    history: [{ at: now(), ic: "i", tx: t("hist.pkgBooked", { count: chosen.length }),
      sub: t("hist.pkgBookedSub", { names: names(chosen), parent: first.parent.name, inv: first.inv.id }),
      type: "PKGBOOK", by: USER, invoiceId: first.inv.id, lines: pkgLines(chosen) }],
  };
  w.cases.unshift(c);
  chosen.forEach((x) => { x.child.visitId = c.id; x.child.bookedAt = now(); });
  recordOn(src, "i", t("hist.pkgBookedSrc", { count: chosen.length }),
    t("hist.pkgBookedSrcSub", { names: names(chosen), clinic: d.clinic, parent: first.parent.name }),
    { type: "PKGBOOK", by: USER, invoiceId: first.inv.id, lines: pkgLines(chosen) });
  fx.toast("ok", t("toast.visitBooked"), t("toast.visitBookedSub", { name: w.patients[d.mrn]!.name, count: chosen.length }));
  return c.id;
}

/* v3 renderPackageStory(): the first procedure still to be booked is suggested; the rest are a click away */
export function pkgStoryOf(w: World, c: Visit): PkgStory {
  if (c.pkgStory) return c.pkgStory;
  const left = packageItemsLeft(w, c.mrn);
  return { stage: 1, sel: left.length ? { [left[0]!.child.code]: true } : {}, clinic: c.clinic, doctor: c.doctor, listOpen: false };
}
export function pkgStoryDo(w: World, c: Visit, fn: (ps: PkgStory) => void) {
  if (!c.pkgStory) c.pkgStory = pkgStoryOf(w, c);
  fn(c.pkgStory);
}
export const pkgChosen = (w: World, mrn: string, sel: Record<string, boolean>) => packageItemsLeft(w, mrn).filter((x) => sel[x.child.code]);

/* v3 #pkGo: book the visit and stay on this one, with the result in the story */
export function bookPackageStory(w: World, c: Visit, fx: Fx) {
  const ps = pkgStoryOf(w, c);
  const chosen = pkgChosen(w, c.mrn, ps.sel);
  if (!chosen.length) return;
  const id = createPkgVisit(w, { mrn: c.mrn, clinic: ps.clinic, doctor: ps.doctor }, chosen, fx);
  markDone(c, "package", t("pkg.done", { count: chosen.length }), t("pkg.doneSub", { names: names(chosen), clinic: ps.clinic, doctor: ps.doctor }));
  c.storyDone!.package!.visitId = id;
  c.pkgStory = null;
}

/* v3 printPackageOrders() (line 4932): the package was paid once; performing a child procedure only produces its own
   printed invoice, at nil value, linked to this visit */
export function printPackageOrders(w: World, c: Visit, lines: Line[], fx: Fx) {
  if (!lines.length) return;
  const src = lines[0]!.fromPackage || {};
  const zero = { gross: 0, discount: 0, net: 0, deductible: 0, patient: 0, company: 0, patientWithTax: 0, companyWithTax: 0 };
  const inv: Invoice = {
    id: newInvoiceId(), scope: "orders", at: now(), patient: 0, company: 0, deductible: 0, paid: true, via: "Package", viaDetail: "",
    payer: payerOf(w, c).label, packagePrint: { parent: src.parent, invoiceId: src.invoiceId },
    rows: lines.map((l) => ({ name: l.name, code: l.code, calc: { ...zero } })),
  };
  c.invoices.unshift(inv);
  lines.forEach((l) => { l.paid = true; l.via = "Package"; l.invoiceId = inv.id; });
  c.bill = null; c.link = null;
  recordOn(c, "", t("hist.pkgPrinted", { id: inv.id }),
    t("hist.pkgPrintedSub", { names: lines.map((l) => l.name).join(", "), parent: src.parent || t("hist.thePackage"), inv: src.invoiceId }),
    { type: "PKGPRINT", invoiceId: inv.id, amount: 0, mode: "Package", scope: "orders", lines: lines.map((l) => ({ name: l.name, code: l.code, ins: "notcovered", price: 0 })) });
  fx.toast("ok", t("toast.pkgPrinted", { id: inv.id }), t("toast.pkgPrintedSub", { name: pt(w, c).name }));
}

/* v3 voidPrint() (line 4989): nothing was charged, so undoing the print voids it and hands the procedure back */
export function voidPrint(w: World, c: Visit, invId: string, reason: string, fx: Fx) {
  const inv = c.invoices.find((i) => i.id === invId);
  if (!inv) return;
  inv.voided = { at: now(), by: USER, reason };
  inv.paid = false;
  /* the procedure returns to this visit as not yet printed */
  c.orders.filter((o) => o.invoiceId === invId).forEach((o) => { o.invoiceId = null; o.paid = false; o.via = null; });
  recordOn(c, "w", t("hist.pkgVoided", { id: invId }), t("hist.pkgVoidedSub", { names: inv.rows.map((r) => r.name).join(", "), reason }),
    { type: "VOID", invoiceId: invId, amount: 0, reason, lines: inv.rows.map((r) => ({ name: r.name, code: r.code, ins: "notcovered", price: 0 })) });
  fx.toast("warn", t("toast.pkgVoided", { id: invId }), t("toast.pkgVoidedSub", { name: pt(w, c).name }));
}

/* v3 openPkgBook() (line 5099): the profile's pop-up, on the procedure asked for */
export function pkgBookFor(w: World, mrn: string, preselect: string | undefined, fx: Fx) {
  const left = packageItemsLeft(w, mrn);
  if (!left.length) { fx.toast("", t("toast.nothingToBook"), t("toast.nothingToBookSub")); return null; }
  const from = left[0]!.c;
  return { mrn, sel: preselect ? { [preselect]: true } : {}, clinic: from.clinic, doctor: from.doctor };
}
