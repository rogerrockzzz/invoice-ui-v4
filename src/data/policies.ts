/* The payer policy as the HIS holds it (the "Payer Policy" screen). v4 only — v3 has no such data, so this sits
   apart from seed.ts (which must stay identical to v3). Anything not listed here is filled in by domain/policy.ts. */
export interface PolicyExtra {
  contactPerson?: string;
  contractExpiry?: string; /* yyyy-mm-dd */
  descriptionAr?: string;
  validFrom?: string; /* yyyy-mm-dd */
  validTo?: string; /* yyyy-mm-dd */
  hospitalVisitLimit?: number;
  pharmacyVisitLimit?: number;
  includeMedicine?: boolean;
  excludeConsultation?: boolean;
  approvalRequired?: boolean;
  approvalValidDays?: number;
  followUpDays?: number;
  extendedFollowUpDays?: number;
  cchiPolicy?: string;
  inpatientShare?: number;
  pharmacyShare?: number;
  taxable?: boolean;
  interCompanyHospital?: string;
  active?: boolean;
}

export const POLICY_EXTRA: Record<string, PolicyExtra> = {
  "NCCI-A": { contactPerson: "TAHER", contractExpiry: "2027-07-31", descriptionAr: "الفئة أ", validFrom: "2022-12-01", validTo: "2030-12-31",
    hospitalVisitLimit: 20000, pharmacyVisitLimit: 1000000, approvalValidDays: 11, followUpDays: 0, extendedFollowUpDays: 9,
    cchiPolicy: "CCHI-1104-A", pharmacyShare: 20 },
  "MEDGULF-B": { contactPerson: "FAISAL AL OTAIBI", contractExpiry: "2026-12-31", descriptionAr: "بلس ب", validFrom: "2024-01-01",
    hospitalVisitLimit: 15000, pharmacyVisitLimit: 50000, approvalValidDays: 7, followUpDays: 14, extendedFollowUpDays: 7,
    cchiPolicy: "CCHI-1310-B", pharmacyShare: 10 },
  "BUPA-GOLD": { contactPerson: "RANA AL SHEHRI", contractExpiry: "2027-06-30", descriptionAr: "ذهبي", validFrom: "2023-07-01",
    hospitalVisitLimit: 50000, pharmacyVisitLimit: 250000, includeMedicine: true, approvalValidDays: 14, followUpDays: 14,
    extendedFollowUpDays: 7, cchiPolicy: "CCHI-2288-G", pharmacyShare: 10 },
  "TAW-SILVER": { contactPerson: "MAJED AL ZAHRANI", contractExpiry: "2026-09-30", descriptionAr: "فضي", validFrom: "2023-10-01",
    hospitalVisitLimit: 10000, pharmacyVisitLimit: 30000, approvalValidDays: 7, followUpDays: 10, extendedFollowUpDays: 0,
    cchiPolicy: "CCHI-3002-S", pharmacyShare: 25 },
  "GIG-C": { contactPerson: "HANAN AL QAHTANI", contractExpiry: "2027-02-28", descriptionAr: "الفئة ج", validFrom: "2026-03-01",
    hospitalVisitLimit: 8000, pharmacyVisitLimit: 20000, approvalValidDays: 7, followUpDays: 7, extendedFollowUpDays: 0,
    cchiPolicy: "CCHI-4120-C", pharmacyShare: 30 },
  "CH-HABIB": { contactPerson: "SOCIAL SERVICES", descriptionAr: "تغطية كاملة", taxable: false, pharmacyShare: 0 },
  "CH-ZAKAT": { contactPerson: "SOCIAL SERVICES", descriptionAr: "تغطية كاملة", taxable: false, pharmacyShare: 0 },
  "STAFF-FAM": { contactPerson: "HR BENEFITS", descriptionAr: "عائلة الموظف", pharmacyShare: 50 },
};
