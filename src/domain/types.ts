/* Types mirror the v3 prototype's data (journey-opd-v3.html lines 861–1226). Field names are kept
   identical so the port can be checked line by line against v3. */

export type InsStatus = "approved" | "partial" | "pending" | "rejected" | "notcovered" | "notinsured";
export type AdvCat = "Open" | "Doctor" | "Clinic";
export type Scope = "consult" | "orders" | "visit";

export interface Plan {
  name: string;
  deductiblePct: number;
  discountPct: number;
  visitCap: number;
  annualLeft: number;
  internal?: boolean;
}

export interface Payer {
  id: string;
  label: string;
  plan: Plan | null;
  internal?: boolean;
}

export interface LedgerEntry {
  k?: number;
  at: string;
  date?: string;
  by?: string;
  type: "ADV_IN" | "ADV_USED" | "REFUND_IN" | "ADV_REFUND" | "CREDIT_RAISED" | "CREDIT_SETTLED";
  amount: number;
  cat?: AdvCat | "";
  mode?: string;
  invoiceId?: string | null;
  visitId?: number | null;
  note?: string;
  docId?: string;
}

export interface WalletDoc {
  id: string;
  kind: "wallet";
  wtype: LedgerEntry["type"];
  mrn: string;
  at: string;
  date: string;
  amount: number;
  cat: string;
  mode: string;
  visitId: number | null;
  invoiceId: string | null;
  note: string;
  by: string;
  /* wallet docs travel in invoice lists; these keep the shape compatible */
  patient?: number;
  paid?: boolean;
  via?: string;
  settled?: boolean;
  rows?: InvoiceRow[];
  refundedTotal?: number;
}

export interface Patient {
  mrn: string;
  name: string;
  age: string | number;
  gender: string;
  mobile: string;
  wallet: { advance: Record<AdvCat, number> };
  payers: Payer[];
  ledger?: LedgerEntry[];
  walletDocs?: WalletDoc[];
  activePayerId?: string;
}

export interface LineChild {
  code: string;
  name: string;
  visitId?: number;
}

export interface Line {
  code: string;
  name: string;
  price: number;
  priceIns?: number;
  priceCash?: number;
  ins?: InsStatus;
  paid?: boolean;
  via?: string | null;
  invoiceId?: string | null;
  ordered?: string;
  branch?: string;
  performed?: string;
  package?: boolean;
  children?: LineChild[];
  byReception?: boolean;
  selfPay?: boolean;
  urgentCash?: boolean;
  approvalPending?: boolean;
  approvalGranted?: InsStatus;
  insWas?: InsStatus;
  appr?: Record<string, InsStatus>;
  elsewhere?: boolean;
  notApplicable?: boolean;
  refunded?: boolean;
  fromPackage?: { parent?: string; invoiceId?: string; visitId?: number };
}

export interface Calc {
  gross: number;
  discount: number;
  net: number;
  deductible: number;
  patient: number;
  company: number;
  patientWithTax: number;
  companyWithTax: number;
}

export interface InvoiceRow {
  name: string;
  code: string;
  calc: Calc;
  package?: boolean;
  children?: LineChild[] | null;
  refunded?: boolean;
}

export interface Payment {
  mode: string;
  amount: number;
  ref?: string;
}

export interface Invoice {
  id: string;
  scope: Scope;
  at: string;
  patient: number;
  company: number;
  deductible: number;
  paid: boolean;
  via?: string;
  viaDetail?: string;
  payments?: Payment[] | null;
  payer?: string;
  rows: InvoiceRow[];
  settled?: boolean;
  voided?: unknown;
  replaced?: unknown;
  packagePrint?: boolean;
  claimed?: boolean;
  branch?: string | null;
  replaces?: string[] | null;
  credited?: number;
  cashOnly?: boolean;
  billType?: string;
  refundedTotal?: number;
  refunds?: unknown[];
  kind?: string;
}

export interface Bill {
  scope: Scope;
  codes: string[];
  at: string;
  patient: number;
  company: number;
  deductible: number;
  rows: InvoiceRow[];
  cashOnly?: boolean;
  due?: number;
  billType?: string;
  payerLabel?: string | null;
  replacing?: { ids: string[]; credited: number; to: string; partial: boolean } | null;
}

export interface HistoryLine {
  name: string;
  code: string;
  ins?: InsStatus | string;
  price?: number;
}

/* v3 history entries keep their text as light markup (only <b>); the UI renders <b> and nothing else */
export interface HistoryEvent {
  at: string;
  ic: string;
  tx: string;
  sub: string;
  type: string;
  by: string;
  story?: string;
  scope?: Scope;
  invoiceId?: string | null;
  amount?: number;
  company?: number;
  deductible?: number;
  mode?: string;
  lines?: HistoryLine[];
  [k: string]: unknown;
}

export interface StoryDone {
  title: string;
  sub: string;
  at: string;
  cash?: boolean;
}

export interface Visit {
  id: number;
  mrn: string;
  visitType: string;
  clinic: string;
  doctor: string;
  arrived: string;
  date: string;
  sortKey: number;
  payerId: string;
  dedUsed: number;
  consult: Line;
  orders: Line[];
  invoices: Invoice[];
  refundInvoices?: Invoice[];
  bill: Bill | null;
  link: { at: string; ageMin: number; auto: boolean } | null;
  closed: boolean;
  prefs: { waitAll?: boolean };
  history: HistoryEvent[];
  interbranch?: boolean;
  fromBranch?: string;
  parentId?: number;
  future?: boolean;
  slot?: string;
  fromPackage?: boolean;
  clinical?: { at: string };
  lwbs?: { at: string; by: string; reason?: string };
  storyDone?: Record<string, StoryDone>;
  activeStory?: string | null;
  visitPinned?: boolean;
  seen?: Record<string, boolean>;
  sel?: Record<string, boolean>;
  payerStory?: { stage: number; choice?: { kind?: string } & Record<string, unknown>; form?: unknown } | null;
  pkgStory?: { stage: number } | null;
  addStory?: { stage: number } | null;
  checks?: number;
  lastCheck?: string | null;
  docChecks?: number;
  lastDocCheck?: string | null;
  orderChecks?: number;
  lastOrderCheck?: string | null;
  orderRounds?: number;
  creditSel?: Record<string, boolean> | null;
}

export interface Settings {
  autoSend: boolean;
  branch: string;
}

export interface World {
  patients: Record<string, Patient>;
  cases: Visit[];
  settings: Settings;
}

/* the bits of UI state v3's storyStage() reads from its global `state` — passed explicitly in v4 */
export interface StoryUiCtx {
  drawer?: { caseId: number; refund?: boolean; refundDiff?: boolean; credit?: boolean } | null;
  refundInvoiceId?: string | null;
  replaceCaseId?: number | null;
}

/* text a step shows: an i18n key plus its interpolation params; a param may itself be a Msg */
export interface Msg {
  k: string;
  p?: Record<string, string | number | Msg>;
}
