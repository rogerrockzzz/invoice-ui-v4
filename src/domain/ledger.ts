import { ADV_TYPES, CREDIT_TYPES, USER, WALLET_DOC } from "./constants";
import { nextWalletDocNo } from "./ids";
import { round2 } from "./money";
import type { LedgerEntry, WalletDoc, World } from "./types";

/* v3 lines 1565–1575: every advance / credit movement produces a numbered document */
export function makeWalletDoc(w: World, mrn: string, e: LedgerEntry): WalletDoc | null {
  const t = WALLET_DOC[e.type];
  if (!t || e.docId) return null;
  const id = `${t.pre}-${nextWalletDocNo()}`;
  const doc: WalletDoc = {
    id, kind: "wallet", wtype: e.type, mrn, at: e.at, date: e.date || "Today", amount: e.amount, cat: e.cat || "",
    mode: e.mode || "", visitId: e.visitId || null, invoiceId: e.invoiceId || null, note: e.note || "", by: e.by || USER,
  };
  const p = w.patients[mrn]!;
  (p.walletDocs = p.walletDocs || []).push(doc);
  e.docId = id;
  return doc;
}

/* v3 lines 1585–1595: advance and credit are two separate accounts, so each is replayed on its own */
export function ledgerRows(w: World, mrn: string, kind: "ADV" | "CREDIT") {
  const types = kind === "CREDIT" ? CREDIT_TYPES : ADV_TYPES;
  const es = (w.patients[mrn]!.ledger || []).filter((e) => types.includes(e.type)).sort((a, b) => (a.k || 0) - (b.k || 0));
  let bal = 0;
  const out = es.map((e) => {
    const inflow = e.type === "ADV_IN" || e.type === "REFUND_IN" || e.type === "CREDIT_RAISED";
    bal = round2(inflow ? bal + e.amount : bal - e.amount);
    return { ...e, balance: bal, inflow };
  });
  return out.reverse();
}

/* v3 lines 5925–5926: number the advance and credit movements already on file, oldest first */
export function numberSeedLedger(w: World) {
  Object.values(w.patients).forEach((p) =>
    [...(p.ledger || [])].sort((a, b) => (a.k || 0) - (b.k || 0)).forEach((e) => makeWalletDoc(w, p.mrn, e)),
  );
}
