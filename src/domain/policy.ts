import { NPHIES, PAYER_DIRECTORY } from "../data/seed";
import { POLICY_EXTRA } from "../data/policies";
import { VAT } from "./constants";
import type { Payer } from "./types";

/* The payer's policy as shown on the profile's "Payer Policy" pop-up. The plan (deductible, cap, discount) is the
   one billing uses; contract and validity come from NPHIES or the payer directory; the rest is the HIS record. */
export interface PayerPolicy {
  groupName: string;
  contract: string;
  contactPerson: string;
  contractExpiry: string;
  description: string;
  descriptionAr: string;
  validFrom: string;
  validTo: string;
  hospitalVisitLimit: number | null;
  pharmacyVisitLimit: number | null;
  includeMedicine: boolean;
  excludeConsultation: boolean;
  approvalRequired: boolean;
  approvalValidDays: number | null;
  followUpDays: number;
  extendedFollowUpDays: number;
  cchiPolicy: string;
  deductible: boolean;
  deductibleType: "%";
  shareType: "%";
  outpatientShare: number;
  inpatientShare: number;
  pharmacyShare: number;
  visitCap: number;
  discountPct: number;
  taxable: boolean;
  taxPct: number;
  interCompanyHospital: string;
  active: boolean;
}

/* yyyy-mm-dd → dd-mm-yyyy, as the HIS shows it */
export const hisDate = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("-") : d);

const pct = (x: number) => Math.round(x * 100);

/* null for self-pay: there is no policy to show */
export function policyOf(p: Payer): PayerPolicy | null {
  const plan = p.plan;
  if (!plan) return null;
  const nph = Object.values(NPHIES).flat().find((x) => x.id === p.id);
  const dir = PAYER_DIRECTORY.find((x) => x.id === p.id);
  const x = POLICY_EXTRA[p.id] || {};
  const [insurer, cls] = p.label.split("·").map((s) => s.trim());
  const internal = !!(plan.internal || p.internal);
  return {
    groupName: nph?.group || dir?.group || insurer || p.label,
    contract: nph?.contract || dir?.contract || "",
    contactPerson: x.contactPerson || "",
    contractExpiry: x.contractExpiry || nph?.validTo || "",
    description: cls || plan.name,
    descriptionAr: x.descriptionAr || "",
    validFrom: x.validFrom || "",
    validTo: x.validTo || nph?.validTo || x.contractExpiry || "",
    hospitalVisitLimit: x.hospitalVisitLimit ?? null,
    pharmacyVisitLimit: x.pharmacyVisitLimit ?? null,
    includeMedicine: !!x.includeMedicine,
    excludeConsultation: !!x.excludeConsultation,
    /* internal payers approve on their own reference */
    approvalRequired: x.approvalRequired ?? !internal,
    approvalValidDays: internal ? null : x.approvalValidDays ?? 7,
    followUpDays: x.followUpDays ?? 0,
    extendedFollowUpDays: x.extendedFollowUpDays ?? 0,
    cchiPolicy: internal ? "" : x.cchiPolicy || "",
    /* the patient carries a percentage share (capped per visit), not a fixed deductible */
    deductible: false,
    deductibleType: "%",
    shareType: "%",
    outpatientShare: pct(plan.deductiblePct),
    inpatientShare: x.inpatientShare ?? 0,
    pharmacyShare: x.pharmacyShare ?? pct(plan.deductiblePct),
    visitCap: plan.visitCap,
    discountPct: pct(plan.discountPct),
    taxable: x.taxable ?? true,
    taxPct: x.taxable === false ? 0 : pct(VAT),
    interCompanyHospital: x.interCompanyHospital || "",
    active: x.active ?? true,
  };
}
