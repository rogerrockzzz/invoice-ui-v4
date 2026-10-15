import type { AdvCat, InsStatus, Payer } from "./types";

/* v3 lines 862–943 */
export const VAT = 0.15;
export const CASH_FACTOR = 0.88;
export const USER = "SAADAN SAAFAN";

export const INS_STATUSES: Record<InsStatus, { label: string; cov: number; insured: boolean }> = {
  approved: { label: "Approved", cov: 1, insured: true },
  partial: { label: "Partially approved", cov: 0.6, insured: true },
  pending: { label: "Awaiting approval", cov: 0, insured: false },
  rejected: { label: "Rejected", cov: 0, insured: false },
  notcovered: { label: "Not covered", cov: 0, insured: false },
  notinsured: { label: "Self-pay", cov: 0, insured: false },
};

/* how an advance is received at the desk (v3 line 875) */
export const DESK_MODES = ["Cash", "Card", "Bank transfer"];

export interface PayMode {
  id: string;
  label?: string;
  icon: "card" | "cash" | "wallet" | "hospital" | "receipt";
  top?: boolean;
  ref?: "card" | "cash" | "referral" | "finance";
  advance?: AdvCat;
  note?: string;
}

/* The modes used in production, ordered by how often they are used.
   The four commonest are on the face of the drawer; the rest sit behind "more". */
export const PAY_MODES: PayMode[] = [
  { id: "Span", icon: "card", top: true, ref: "card" },
  { id: "Visa", icon: "card", top: true, ref: "card" },
  { id: "Master card", icon: "card", top: true, ref: "card" },
  { id: "Cash", icon: "cash", top: true, ref: "cash" },
  { id: "MADA", icon: "card", ref: "card" },
  { id: "Amex", icon: "card", ref: "card" },
  { id: "OPEN", icon: "wallet", advance: "Open", note: "open advance" },
  { id: "DOCTOR", icon: "wallet", advance: "Doctor", note: "doctor advance" },
  { id: "CLINIC", icon: "wallet", advance: "Clinic", note: "clinic advance" },
  { id: "INTER_COMPANY_REFERRAL_PAYMENT", label: "Inter-company referral", icon: "hospital", ref: "referral" },
  { id: "Cash From Finance", label: "Cash from finance", icon: "receipt", ref: "finance" },
  { id: "Credit", icon: "receipt", top: true, note: "settle later" },
];
export const payMode = (id: string): PayMode => PAY_MODES.find((m) => m.id === id) || { id, icon: "receipt" };
export const modeLabel = (id: string) => {
  const m = payMode(id);
  return m.label || m.id;
};
/* what is most often taken alongside each mode, straight from the production combos */
export const SECOND_MODE: Record<string, string> = {
  Span: "Span", Visa: "Visa", "Master card": "Master card", MADA: "Span", Amex: "Span",
  Cash: "Span", OPEN: "Span", DOCTOR: "Span", CLINIC: "Span",
};
export const secondMode = (first: string) => SECOND_MODE[first] || "Span";

export const REFUND_MODES = ["Cash", "Span", "Visa", "Master card", "Advance wallet"];
export const ADV_CATS: AdvCat[] = ["Open", "Doctor", "Clinic"];
export const CASH_PAYER: Payer = { id: "CASH", label: "Cash / Self-pay", plan: null };
export const CLINICS = ["PAEDIATRICS", "CARDIOLOGY", "DERMATOLOGY", "ORTHOPAEDICS", "INTERNAL MEDICINE", "ENT"];
export const BRANCHES = ["AL Hamra Hospital", "AL Takhassusi Hospital", "AL Rayan Hospital", "Arryan Hospital", "Qassim Hospital"];
export const DOCTORS = ["LINA FAROUK", "AHMED AL SUBAIE", "HUDA AL MUTAIRI", "OMAR HASSAN", "SARA AL DOSSARI"];
export const VISIT_TYPES = ["Consultation", "Follow-up", "Procedure only"];

export interface CatalogItem {
  code: string;
  name: string;
  kind: "package" | "order";
  price: number;
  noDoctor: boolean;
  trend?: number;
  children?: string[];
}
/* What can be ordered. Reception may add anything that needs no doctor; those are billed to
   the patient at the cash price. "trend" is how often it has been taken recently. */
export const ORDER_CATALOG: CatalogItem[] = [
  { code: "PKG-EXEC", name: "Executive Health Check", kind: "package", price: 1200, noDoctor: true, trend: 98,
    children: ["Complete Blood Count", "Lipid Profile", "HbA1c", "Liver Function", "Kidney Function", "Vitamin D Total"] },
  { code: "PKG-DIAB", name: "Diabetes Screening Package", kind: "package", price: 350, noDoctor: true, trend: 91,
    children: ["Fasting Glucose", "HbA1c", "Urine Microalbumin"] },
  { code: "LAB-VITD", name: "Vitamin D Total", kind: "order", price: 180, noDoctor: true, trend: 88 },
  { code: "PKG-WOMEN", name: "Women's Wellness Package", kind: "package", price: 950, noDoctor: true, trend: 80,
    children: ["Complete Blood Count", "Thyroid Panel", "Iron Studies", "Vitamin D Total"] },
  { code: "LAB-LIPID", name: "Lipid Profile", kind: "order", price: 120, noDoctor: true, trend: 74 },
  { code: "LAB-THY", name: "Thyroid Panel", kind: "order", price: 260, noDoctor: true, trend: 70 },
  { code: "PKG-PREM", name: "Pre-marital Screening", kind: "package", price: 480, noDoctor: true, trend: 62,
    children: ["Complete Blood Count", "Haemoglobin Electrophoresis", "Hepatitis B & C", "HIV Screen"] },
  { code: "LAB-CBC", name: "Complete Blood Count", kind: "order", price: 90, noDoctor: true, trend: 55 },
  { code: "RAD-MRI-B", name: "MRI Brain", kind: "order", price: 2200, noDoctor: false },
  { code: "RAD-CT-C", name: "CT Chest", kind: "order", price: 1400, noDoctor: false },
  { code: "CAR-ECHO2", name: "Echocardiogram", kind: "order", price: 900, noDoctor: false },
];
export const trendingOrders = (n = 4) =>
  ORDER_CATALOG.filter((x) => x.noDoctor).sort((a, b) => (b.trend || 0) - (a.trend || 0)).slice(0, n);
export const CONSULT_FEES: Record<string, number> = {
  PAEDIATRICS: 200, CARDIOLOGY: 300, DERMATOLOGY: 250, ORTHOPAEDICS: 250, "INTERNAL MEDICINE": 220, ENT: 230,
};

/* v3 lines 1541–1563 */
export const LEDGER_LABEL: Record<string, string> = {
  ADV_IN: "Advance received", ADV_USED: "Advance used", REFUND_IN: "Refund to wallet", ADV_REFUND: "Advance refunded",
  CREDIT_RAISED: "Put on credit", CREDIT_SETTLED: "Credit settled",
};
export const WALLET_DOC: Record<string, { pre: string; title: string; label: string; sign: 1 | -1; acct: "Advance" | "Credit" }> = {
  ADV_IN: { pre: "ADV", title: "ADVANCE RECEIPT", label: "Advance received", sign: 1, acct: "Advance" },
  REFUND_IN: { pre: "ADV", title: "ADVANCE RECEIPT", label: "Refund to advance", sign: 1, acct: "Advance" },
  ADV_USED: { pre: "ADV", title: "ADVANCE USED", label: "Advance used", sign: -1, acct: "Advance" },
  ADV_REFUND: { pre: "RADV", title: "ADVANCE REFUND", label: "Advance refunded", sign: -1, acct: "Advance" },
  CREDIT_RAISED: { pre: "CRED", title: "CREDIT NOTE", label: "Credit raised", sign: 1, acct: "Credit" },
  CREDIT_SETTLED: { pre: "CRED", title: "CREDIT SETTLEMENT", label: "Credit settled", sign: -1, acct: "Credit" },
};
export const ADV_TYPES = ["ADV_IN", "ADV_USED", "REFUND_IN", "ADV_REFUND"];
export const CREDIT_TYPES = ["CREDIT_RAISED", "CREDIT_SETTLED"];

export const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
