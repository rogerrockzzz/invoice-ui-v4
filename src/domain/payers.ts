import { NPHIES, PAYER_DIRECTORY } from "../data/seed";
import { ORDER_CATALOG, type CatalogItem } from "./constants";
import { fmt } from "./money";
import { calcLine } from "./pricing";
import type { Msg, NphiesPolicy, PayerChoice, PayerStory, Plan, World } from "./types";

/* v3 lines 1032–1036: the directory is only ever searched — never listed in full */
export function searchPayers(f: { group?: string; contract?: string; policy?: string }) {
  const has = (v: string | undefined, q: string | undefined) => !q || String(v || "").toLowerCase().includes(q.trim().toLowerCase());
  /* the group field also matches the payer's name */
  return PAYER_DIRECTORY.filter((x) => (has(x.label, f.group) || has(x.group, f.group)) && has(x.contract, f.contract) && has(x.policy, f.policy));
}

/* what NPHIES answers for a patient (v3 finishEligibility, line 2269) */
export const eligibilityOf = (mrn: string): NphiesPolicy[] => (NPHIES[mrn] || []).map((r) => ({ ...r }));

/* v3 line 2278: the plan behind an NPHIES result — the one on file, or the one NPHIES returned */
export const nphiesPlan = (w: World, mrn: string, r: NphiesPolicy): Plan | null =>
  w.patients[mrn]!.payers.find((p) => p.id === r.id)?.plan || r.plan || null;

/* v3 tobHtml() (line 2280): a table of benefits, drawn from the plan. Cells are i18n messages. */
export function tobRows(plan: Plan | null, label?: string): Msg[][] {
  if (!plan) return [];
  const d = Math.round(plan.deductiblePct * 100), cap = fmt(Math.min(plan.visitCap || 0, plan.annualLeft || 0));
  const gold = /GOLD|CLASS A/i.test(label || plan.name);
  const m = (k: string, p?: Msg["p"]): Msg => ({ k: `tob.${k}`, p });
  const dash = m("dash");
  if (plan.internal)
    return [
      [m("b.consult"), d ? m("pctCovered", { pct: 100 - d }) : m("coveredFull"), d ? m("pctShare", { pct: d }) : dash, m("perVisit"), m("internalApproval")],
      [m("b.labRad"), d ? m("pctCovered", { pct: 100 - d }) : m("coveredFull"), d ? m("pct", { pct: d }) : dash, m("perVisit"), m("internalApproval")],
      [m("b.packages"), m("notCovered"), dash, dash, dash],
    ];
  return [
    [m("b.consultGp"), m("pctCovered", { pct: 100 - d }), m("dedMax", { pct: d, cap }), m("perVisit"), m("no")],
    [m("b.lab"), m("pctCovered", { pct: 100 - d }), m("ded", { pct: d }), m("annualLeft", { amount: fmt(plan.annualLeft) }), m("above", { amount: "SAR 500" })],
    [m("b.radXray"), m("pctCovered", { pct: 100 - d }), m("ded", { pct: d }), m("annualLimit"), m("no")],
    [m("b.radMri"), m("pctCovered", { pct: 100 - d }), m("ded", { pct: d }), m("annualLimit"), m("yes")],
    [m("b.pharmacy"), m("pctCovered", { pct: 80 }), m("copay", { pct: 20 }), m("annualLimit"), m("above", { amount: "SAR 300" })],
    [m("b.dental"), gold ? m("covered") : m("notCovered"), gold ? m("copay", { pct: 20 }) : dash, gold ? m("perYear", { amount: "SAR 2,000" }) : dash, gold ? m("yes") : dash],
    [m("b.maternity"), m("covered"), dash, m("plain", { text: gold ? "SAR 15,000" : "SAR 8,000" }), m("yes")],
    [m("b.wellness"), m("notCovered"), dash, dash, dash],
  ];
}

/* the options on the Choose payer stage (v3 renderPayerStory stage 2, lines 2334–2337) */
export interface PayerOption {
  id: string; label: string; kind: string; status?: string; reason?: string; isNew?: boolean; unverified?: boolean;
  sub: Msg; plan: Plan | null; src?: NphiesPolicy;
}
export function payerOptions(w: World, mrn: string, ps: PayerStory) {
  const ins: PayerOption[] = (ps.results || []).map((r) => ({
    id: r.id, label: `${r.insurer} · ${r.cls}`, status: r.status, reason: r.reason, isNew: r.isNew,
    sub: { k: "payer.policySub", p: { no: r.policyNo, card: r.cardId, to: r.validTo } }, plan: nphiesPlan(w, mrn, r), src: r, kind: "Company",
  }));
  const cash: PayerOption = { id: "CASH", label: "Cash / Self-pay", kind: "Cash", sub: { k: "payer.cashSub" }, plan: null };
  return { ins, cash, all: [...ins, cash] };
}

/* v3 data-choose (line 2354): cash goes straight to the result, anything else to the policy details */
export function choosePayer(ps: PayerStory, o: PayerOption) {
  const r: Partial<NphiesPolicy> = o.src || {};
  ps.choice = { id: o.id, label: o.label, kind: o.kind, plan: o.plan || null, unverified: !!o.unverified };
  ps.form = o.kind === "Cash" ? null : {
    type: o.kind === "Company" ? "Company" : o.kind, group: r.group || "", contract: r.contract || "", policy: r.policy || (o.plan ? o.plan.name : ""),
    policyNo: r.policyNo || "", subPolicy: r.subPolicy || "", cardId: r.cardId || "", validTo: r.validTo || "",
    holderCode: r.holderCode || "", holder: r.holder || "", active: true, fromNphies: o.kind === "Company" && !o.unverified,
  };
  ps.stage = o.kind === "Cash" ? 4 : 3;
  return o.kind === "Cash";
}
/* v3 #pyManual (line 2347) */
export function startManual(ps: PayerStory) {
  ps.choice = { id: null, label: "", kind: null, plan: null, manual: true };
  ps.form = { type: "", group: "", contract: "", policy: "", policyNo: "", subPolicy: "", cardId: "", validTo: "", holderCode: "", holder: "", active: true, fromNphies: false };
  ps.stage = 3;
}
export const PAYER_REQUIRED = ["group", "contract", "policy", "policyNo"] as const;
export const payerReady = (ps: PayerStory) => !!ps.choice?.id && !!ps.form && PAYER_REQUIRED.every((k) => String(ps.form![k] || "").trim());
export const payerIsInternal = (ch?: PayerChoice) => !!ch && !!ch.kind && ch.kind !== "Company";

/* typing in a policy field; on manual entry, changing what identifies the payer means picking it again (v3 line 2420) */
export type PolicyField = "group" | "contract" | "policy" | "policyNo" | "subPolicy" | "cardId" | "validTo" | "holderCode" | "holder";
export function editPayerField(ps: PayerStory, k: PolicyField, v: string) {
  if (!ps.form || !ps.choice) return;
  ps.form[k] = v;
  if (ps.choice.manual && ["group", "contract", "policy"].includes(k) && ps.choice.id) {
    Object.assign(ps.choice, { id: null, label: "", kind: null, plan: null });
    ps.form.type = "";
  }
}
/* manual entry: the three payer fields search the list in place (v3 showMatches, line 2404) */
export function payerMatches(ps: PayerStory) {
  const f = ps.form;
  if (!f || ![f.group, f.contract, f.policy].some((v) => String(v || "").trim().length >= 2)) return null;
  return searchPayers({ group: f.group, contract: f.contract, policy: f.policy })
    .filter((x) => !(ps.results || []).some((r) => r.id === x.id && r.status === "Eligible"));
}
export function pickDirectory(ps: PayerStory, id: string) {
  const x = PAYER_DIRECTORY.find((p) => p.id === id);
  if (!x || !ps.choice || !ps.form) return;
  Object.assign(ps.choice, { id: x.id, label: x.label, kind: x.kind, plan: x.plan, unverified: x.kind === "Company" });
  Object.assign(ps.form, { type: x.kind === "Company" ? "Company" : x.kind, group: x.group, contract: x.contract, policy: x.policy });
}

/* ---- ordering at reception (v3 lines 2175–2205) ---- */
export const catPrice = (it: CatalogItem) => calcLine({ price: it.price, ins: "notinsured", selfPay: true }, 0, null).patientWithTax;
export const cartItems = (cart: { sel?: Record<string, boolean> }) => ORDER_CATALOG.filter((x) => (cart.sel || {})[x.code]);
