import { CASH_FACTOR, INS_STATUSES, VAT } from "./constants";
import { planOf } from "./lookup";
import { round2 } from "./money";
import type { Calc, Line, Plan, Visit, World } from "./types";

/* v3 lines 1236–1241 */
export function dedPool(w: World, c: Visit) {
  const plan = planOf(w, c);
  if (!plan) return { cap: 0, used: 0, left: 0 };
  const cap = Math.min(plan.visitCap, plan.annualLeft);
  return { cap, used: c.dedUsed || 0, left: Math.max(0, cap - (c.dedUsed || 0)) };
}

/* v3 lines 1242–1257 */
export function calcLine(line: Pick<Line, "price" | "ins" | "selfPay">, dLeft: number, plan: Plan | null | undefined): Calc {
  if (line.selfPay) plan = null; /* reception-added, no doctor: the patient pays the cash price */
  const meta = INS_STATUSES[line.ins || "notinsured"];
  const gross = line.price;
  const discount = round2(gross * ((plan && plan.discountPct) || 0));
  const net = round2(gross - discount);
  let company = 0,
    deductible = 0,
    patient = net;
  if (plan && meta.insured) {
    const covered = round2(net * meta.cov),
      uncovered = round2(net - covered);
    deductible = round2(Math.min(covered * plan.deductiblePct, Math.max(0, dLeft)));
    patient = round2(deductible + uncovered);
    company = round2(covered - deductible);
  }
  return {
    gross, discount, net, deductible, patient, company,
    patientWithTax: round2(patient * (1 + VAT)),
    companyWithTax: round2(company * (1 + VAT)),
  };
}

export const isPending = (l: Line) => (l.ins || "") === "pending";

/* every line has two prices: the insured tariff and the cash tariff (v3 lines 1260–1262) */
export const cashPriceOf = (l: Line) => (l.priceCash != null ? l.priceCash : +(l.priceIns != null ? l.priceIns : l.price) * CASH_FACTOR);
export const insPriceOf = (l: Line) => (l.priceIns != null ? l.priceIns : l.price);

/* v3 lines 1263–1275. planOverride: undefined = the visit's plan, null = no plan (pure cash) */
export function priceLines(w: World, c: Visit, lines: Line[], planOverride?: Plan | null) {
  const plan = planOverride !== undefined ? planOverride : planOf(w, c);
  let left = plan ? Math.min(plan.visitCap, plan.annualLeft) - (c.dedUsed || 0) : 0;
  const t = { patient: 0, company: 0, deductible: 0, rows: [] as { line: Line; calc: Calc }[] };
  lines.forEach((l) => {
    const calc = calcLine(l, Math.max(0, left), plan);
    left = round2(left - calc.deductible);
    t.patient += calc.patientWithTax;
    t.company += calc.companyWithTax;
    t.deductible += calc.deductible;
    t.rows.push({ line: l, calc });
  });
  t.patient = round2(t.patient);
  t.company = round2(t.company);
  t.deductible = round2(t.deductible);
  return t;
}
