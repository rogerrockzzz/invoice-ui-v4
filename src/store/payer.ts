import { CASH_PAYER, CONSULT_FEES, USER, type CatalogItem } from "../domain/constants";
import { now } from "../domain/clock";
import { newConsultCode, nextVisitId } from "../domain/ids";
import { payerOf, pt } from "../domain/lookup";
import { fmt, round2 } from "../domain/money";
import { cartItems, catPrice, eligibilityOf } from "../domain/payers";
import { payerChangeable } from "../domain/stories";
import type { AddStory, HistoryEvent, Patient, PayerChoice, PayerDecision, PayerDraft, PolicyForm, Visit, World } from "../domain/types";
import { markDone, t, type Fx } from "./actions";
import { recordOn } from "./world";

/* The payer story and the walk-in (v3 lines 1781–1799, 2257–2462, 4006–4152). */

/* v3 setPayer() (line 1781): a new payer means a new approval position for anything not yet billed —
   but what the old insurer approved is kept, in case the visit goes back to it */
export function setPayer(w: World, c: Visit, id: string, fx: Fx) {
  const p = pt(w, c).payers.find((x) => x.id === id) || CASH_PAYER;
  const was = payerOf(w, c).label;
  c.dedUsed = 0;
  const oldId = c.payerId;
  const reset = (l: Visit["consult"]) => {
    if (["approved", "partial", "rejected", "pending"].includes(l.ins || "") && oldId && oldId !== "CASH")
      l.appr = { ...(l.appr || {}), [oldId]: l.ins! };
    if (l.paid) return;
    l.ins = p.plan ? (l.appr && l.appr[p.id]) || "pending" : "notinsured";
  };
  reset(c.consult); c.orders.forEach(reset);
  c.payerId = p.id;
  recordOn(c, "w", t("hist.payerChanged", { was, now: p.label }), t(p.plan ? "hist.payerChangedIns" : "hist.payerChangedCash"), { type: "PAYER", from: was, to: p.label });
  fx.toast("warn", t("toast.payerChanged"), t("toast.payerChangedSub", { name: pt(w, c).name, payer: p.label }));
}

/* v3 startPayerStory() (line 2257); NPHIES answers a moment later (finishEligibility, scheduled by the UI) */
export function startPayerStory(_w: World, c: Visit, fx: Fx) {
  if (!payerChangeable(c)) { fx.toast("warn", t("toast.payerFixed"), t("toast.payerFixedSub")); return false; }
  c.payerStory = { stage: 1, checking: true, at: now() };
  if (c.storyDone) delete c.storyDone.payer;
  c.activeStory = "payer"; c.visitPinned = false;
  return true;
}
/* v3 finishEligibility() (line 2265) — on a visit, or on the stand-in of a visit-to-be */
export function finishEligibility(c: Visit | PayerDraft) {
  const ps = c.payerStory;
  if (!ps || !ps.checking) return;
  ps.checking = false;
  ps.results = eligibilityOf(c.mrn);
  ps.stage = 2;
  const ok = ps.results.filter((r) => r.status === "Eligible");
  recordOn(c as Visit, "i", t("hist.eligibility", { count: ok.length }),
    ps.results.map((r) => `${r.insurer} ${r.cls}: ${r.status}${r.reason ? ` (${r.reason})` : ""}`).join(" · ") || t("hist.noCoverage"),
    { type: "ELIGIBILITY", by: "NPHIES" });
}

/* v3 keepPayerOnPatient() (line 4027): a payer found by NPHIES or entered manually stays on the patient */
export function keepPayerOnPatient(p: Patient, ch: PayerChoice) {
  if (ch.id !== "CASH" && !p.payers.some((x) => x.id === ch.id))
    p.payers.splice(p.payers.length - 1, 0, { id: ch.id!, label: ch.label, plan: ch.plan, internal: ch.kind !== "Company" });
}
const policySub = (f: PolicyForm) =>
  t("hist.payerSetSub", { type: f.type, what: t(f.type === "Company" ? "hist.policy" : "hist.reference"), no: f.policyNo,
    card: f.cardId ? t("hist.card", { card: f.cardId }) : "", valid: f.validTo ? t("hist.validTo", { to: f.validTo }) : "" });

/* v3 applyPayer() (line 2443): put the chosen payer on the patient (if new) and on the visit */
export function applyPayer(w: World, c: Visit, fx: Fx) {
  const ps = c.payerStory!, ch = ps.choice!, p = pt(w, c);
  keepPayerOnPatient(p, ch);
  if (ch.id !== c.payerId) setPayer(w, c, ch.id!, fx);
  /* internal payers approve on their own reference */
  if (ch.plan && ch.plan.internal) [c.consult, ...c.orders].forEach((l) => { if (!l.paid && l.ins === "pending") l.ins = "approved"; });
  c.policy = ps.form ? { ...ps.form, payer: ch.label } : null;
  recordOn(c, "i", t("hist.payerSet", { label: ch.label }), ps.form ? policySub(ps.form) : t("hist.payerSetCash"), { type: "PAYER", to: ch.label });
  markDone(c, "payer", t("done.payer.title", { label: ch.label }), ps.form
    ? t("done.payer.sub", { what: t(ps.form.type === "Company" ? "done.payer.policy" : "done.payer.reference"), no: ps.form.policyNo,
        valid: ps.form.validTo ? t("hist.validTo", { to: ps.form.validTo }) : "", internal: ch.plan && ch.plan.internal ? t("done.payer.internal") : "" })
    : t("done.payer.cash"));
  if (!ps.form) c.storyDone!.payer!.cash = true;
  c.payerStory = null;
}

/* v3 payerDraft() / startWalkinPayer() (lines 4012, 4104): the payer story on a stand-in visit */
export function payerDraft(mrn: string, fee: number, currentId: string | null): PayerDraft {
  return {
    isDraft: true, mrn, payerId: currentId || null, dedUsed: 0, history: [],
    consult: { name: "Consultation", code: "CON-0", price: fee, ins: "approved" },
    payerStory: { stage: 1, checking: true, at: now() },
  };
}
/* v3 draft.onPayer: the decision leaves the stand-in, keeping the eligibility answer for "Back" */
export function draftDecide(d: PayerDraft): PayerDecision {
  const ps = d.payerStory!;
  d.results = ps.results; d.checkedAt = ps.at;
  d.payerStory = null;
  return { choice: { ...ps.choice! }, form: ps.form ? { ...ps.form } : null };
}
/* v3 backToPayerChoices() (line 4006): back to the choices, keeping the eligibility answer already received */
export function backToChoices(d: PayerDraft | null) {
  if (d && d.results) d.payerStory = { stage: 2, results: d.results, at: d.checkedAt || now() };
}

/* v3 renderProfilePayer() #ppSave (line 4088): the profile's payer, applied to the open visits ticked */
export function saveProfilePayer(w: World, mrn: string, d: PayerDecision, ids: number[], fx: Fx) {
  const p = w.patients[mrn]!, ch = d.choice;
  keepPayerOnPatient(p, ch);
  p.activePayerId = ch.id!; p.activePolicy = d.form ? { ...d.form, payer: ch.label } : null;
  ids.forEach((id) => {
    const c = w.cases.find((x) => x.id === id);
    if (!c || !payerChangeable(c)) return;
    c.payerStory = { stage: 3, at: now(), choice: { ...ch }, form: d.form ? { ...d.form } : null };
    applyPayer(w, c, fx);
  });
  fx.toast("ok", t("toast.payerSet", { label: ch.label }), t(ids.length ? "toast.payerSetApplied" : "toast.payerSetNext", { name: p.name, count: ids.length }));
}

/* v3 addReceptionOrders() (line 2206): the same test twice is two lines */
export function addReceptionOrders(c: Visit, items: CatalogItem[], story?: string) {
  items.forEach((it) => {
    let code = it.code, n = 2;
    while (c.orders.some((o) => o.code === code)) code = `${it.code}-${n++}`;
    c.orders.push({
      code, name: it.name, price: it.price, priceIns: it.price, priceCash: it.price, ins: "notinsured", selfPay: true, byReception: true, ordered: now(), paid: false,
      ...(it.kind === "package" ? { package: true, children: it.children!.map((x, i) => ({ code: `${code}-${String.fromCharCode(65 + i)}`, name: x })) } : {}),
    });
  });
  recordOn(c, "i", t("hist.addOrders", { count: items.length }), t("hist.addOrdersSub", { names: items.map((x) => x.name).join(", ") }),
    { type: "ADDORDER", story: story || "addorders", by: USER, lines: items.map((x) => ({ name: x.name, code: x.code, ins: "notinsured", price: x.price })) });
}

/* v3 renderAddOrdersStory() (line 2218): the cart lives on the visit; "Add N order(s)" puts them on it */
export const addStoryOf = (c: Visit): AddStory => c.addStory || { stage: 1, sel: {}, q: "" };
export function addStoryDo(c: Visit, fn: (st: AddStory) => void) {
  if (!c.addStory) c.addStory = { stage: 1, sel: {}, q: "" };
  fn(c.addStory);
}
export function addOrdersStory(w: World, c: Visit, fx: Fx) {
  const items = cartItems(addStoryOf(c));
  if (!items.length) return;
  const total = round2(items.reduce((a, x) => a + catPrice(x), 0));
  addReceptionOrders(c, items);
  markDone(c, "addorders", t("addorders.done", { count: items.length }), t("addorders.doneSub", { names: items.map((x) => x.name).join(", "), total: fmt(total) }));
  c.addStory = null;
  fx.toast("ok", t("toast.ordersAdded"), t("toast.ordersAddedSub", { name: pt(w, c).name, count: items.length }));
}

/* v3 createWalkinVisit() (line 4117) */
export interface WalkinSpec {
  mrn: string; type: string; clinic: string; doctor: string; slot: string | null;
  payerDecision: PayerDecision | null; payerId?: string | null; draftHistory?: HistoryEvent[]; items?: CatalogItem[];
}
export function createWalkinVisit(w: World, d: WalkinSpec, fx: Fx): Visit {
  const chosen = w.patients[d.mrn]!;
  const fee = CONSULT_FEES[d.clinic] || 200;
  const pd = d.payerDecision;
  let payerId = d.payerId || null;
  if (pd) { keepPayerOnPatient(chosen, pd.choice); payerId = pd.choice.id; }
  const insured = payerId !== "CASH";
  const internal = !!(pd && pd.choice.plan && pd.choice.plan.internal);
  const proc = d.type === "Procedure only";
  const c: Visit = {
    id: nextVisitId(), mrn: chosen.mrn, visitType: d.type, clinic: d.clinic, doctor: d.doctor, arrived: now(),
    payerId: payerId!, dedUsed: 0, date: "Today", sortKey: 9001, slot: d.slot || undefined,
    consult: {
      name: `${d.clinic.charAt(0) + d.clinic.slice(1).toLowerCase()} ${d.type === "Follow-up" ? "Follow-up" : "Consultation"}`,
      code: newConsultCode(), price: fee,
      ins: proc ? "notcovered" : insured ? (internal ? "approved" : "pending") : "notinsured",
      paid: proc,
    },
    orders: [], invoices: [], bill: null, link: null, closed: false, prefs: {},
    policy: pd && pd.form ? { ...pd.form, payer: pd.choice.label } : null,
    history: [{ at: now(), ic: "i", tx: t("hist.visitCreated"), by: USER, type: "VISIT", story: "walkin",
      sub: t("hist.visitCreatedSub", { type: d.type, clinic: d.clinic, doctor: d.doctor, slot: d.slot ? t("hist.appointment", { slot: d.slot }) : "" }) }],
  };
  /* what the payer stage did comes with the visit */
  if (pd) {
    (d.draftHistory || []).slice().reverse().forEach((h) => c.history.unshift({ ...h, story: "payer" }));
    c.history.unshift({ at: now(), ic: "i", tx: t("hist.payerSet", { label: pd.choice.label }), sub: pd.form ? policySub({ ...pd.form, cardId: "" }) : t("hist.selfPay"),
      type: "PAYER", story: "payer", by: USER });
  }
  if (insured && !internal && !proc)
    c.history.unshift({ at: now(), ic: "i", tx: t("hist.approvalRequested", { payer: chosen.payers.find((p) => p.id === payerId)!.label.split("·")[0]!.trim() }),
      sub: t("hist.consultation"), type: "APPROVAL", story: "walkin", by: USER });
  w.cases.unshift(c);
  if (d.items && d.items.length) addReceptionOrders(c, d.items, "walkin");
  fx.toast("ok", t("toast.visitCreated"), `${chosen.name} · ${d.clinic}`);
  return c;
}
