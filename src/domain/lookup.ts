import { ADV_CATS, CASH_PAYER } from "./constants";
import type { Invoice, Patient, Visit, WalletDoc, World } from "./types";

/* v3 lines 1229–1233 */
export const pt = (w: World, c: Visit): Patient => w.patients[c.mrn]!;
export const payerOf = (w: World, c: Visit) => pt(w, c).payers.find((p) => p.id === c.payerId) || CASH_PAYER;
export const planOf = (w: World, c: Visit) => payerOf(w, c).plan;
export const walletOf = (w: World, c: Visit) => pt(w, c).wallet;
export const payerName = (w: World, c: Visit) => payerOf(w, c).label.split("·")[0]!.trim();
export const advTotal = (w: World, c: Visit) => ADV_CATS.reduce((a, k) => a + walletOf(w, c).advance[k], 0);
export const firstName = (w: World, c: Visit) => pt(w, c).name.split(" ")[0]!;

/* v3 line 3390: newest first */
export const visitsOf = (w: World, mrn: string) =>
  w.cases.filter((c) => c.mrn === mrn).sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));

/* v3 line 1576 */
export const walletDocsOf = (w: World, c: Visit) => (w.patients[c.mrn]?.walletDocs || []).filter((d) => d.visitId === c.id);

/* v3 lines 1578–1581: the visit a wallet document belongs to — or, for one raised on the profile, a stand-in */
export function walletDocVisit(w: World, d: WalletDoc): Visit {
  return (
    w.cases.find((x) => x.id === d.visitId) ||
    visitsOf(w, d.mrn)[0] ||
    ({ id: null, mrn: d.mrn, clinic: "Wallet", visitType: "—", date: d.date, arrived: d.at, history: [], invoices: [] } as unknown as Visit)
  );
}

/* v3 line 4460 */
export const visitDocs = (c: Visit): Invoice[] => [...c.invoices, ...(c.refundInvoices || [])];

/* v3 lines 4445–4449 */
export function findInvoice(w: World, id: string): { c: Visit; inv: Invoice | WalletDoc } | null {
  for (const c of w.cases) {
    const inv = c.invoices.find((i) => i.id === id) || (c.refundInvoices || []).find((i) => i.id === id);
    if (inv) return { c, inv };
  }
  for (const p of Object.values(w.patients)) {
    const d = (p.walletDocs || []).find((x) => x.id === id);
    if (d) return { c: walletDocVisit(w, d), inv: d };
  }
  return null;
}
