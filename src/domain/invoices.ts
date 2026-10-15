import { MONTHS } from "./constants";
import { today } from "./clock";
import { payerOf, pt, visitDocs, walletDocVisit, visitsOf } from "./lookup";
import { refundState, refundedOf } from "./lines";
import { isoDay, parentVisit, relationTo, rootVisit, visitDate, visitNo } from "./visits";
import { INTERNAL_PAYERS } from "../data/seed";
import { fmt, round2 } from "./money";
import type { Invoice, Msg, Visit, WalletDoc, World } from "./types";

/* v3 lines 4543–4625: invoices are retrieved on request, never all at once */
export type DocRow = { c: Visit; inv: Invoice | WalletDoc };

export function allInvoices(w: World): DocRow[] {
  const out: DocRow[] = [];
  w.cases.forEach((c) => visitDocs(c).forEach((inv) => out.push({ c, inv })));
  return out.sort((a, b) => (b.inv.at || "").localeCompare(a.inv.at || ""));
}

export const INV_PRESETS = { today: "Today", yesterday: "Yesterday", week: "Last 7 days", month: "This month", any: "Any date" } as const;
export type InvPreset = keyof typeof INV_PRESETS | "custom";

export function presetRange(k: InvPreset): [string, string] {
  const t = today();
  t.setHours(0, 0, 0, 0);
  const back = (n: number) => {
    const d = new Date(t);
    d.setDate(d.getDate() - n);
    return isoDay(d);
  };
  if (k === "today") return [isoDay(t), isoDay(t)];
  if (k === "yesterday") return [back(1), back(1)];
  if (k === "week") return [back(6), isoDay(t)];
  if (k === "month") return [isoDay(new Date(t.getFullYear(), t.getMonth(), 1)), isoDay(t)];
  return ["", ""];
}
export function invDate(c: Visit, inv: Invoice | WalletDoc) {
  const m = /^(\d{1,2}) (\w{3})/.exec(inv.at || "");
  if (m && MONTHS[m[2]!] !== undefined) return isoDay(new Date(today().getFullYear(), MONTHS[m[2]!]!, +m[1]!));
  return visitDate(c);
}
export const invPayerType = (w: World, c: Visit, inv: Invoice) => {
  const l = inv.payer || payerOf(w, c).label;
  return /Cash|Self-pay/i.test(l) ? "Cash" : INTERNAL_PAYERS.some((x) => x.label === l) ? "Internal" : "Insurance";
};
export const invType = (inv: Invoice) =>
  inv.kind === "refund" ? "Refund invoice" : inv.packagePrint ? "Package procedure" : inv.scope === "consult" ? "Consultation" : "Doctor's orders";
export const invStatus = (inv: Invoice) => {
  if (inv.kind === "refund") return "Refund";
  const r = refundState(inv);
  return r ? (/Refund/.test(r) ? "Refunded" : r) : inv.paid ? "Paid" : "On credit";
};
export const invMode = (inv: Invoice) => {
  const v = inv.via || "";
  return /Credit/.test(v) ? "Credit" : /link/i.test(v) ? "Payment link" : /Cash/.test(v) ? "Cash"
    : /OPEN|DOCTOR|CLINIC|Advance/i.test(v) ? "Advance" : v ? "Card" : "";
};

export interface InvFilters {
  preset: InvPreset; from: string; to: string;
  clinic: string; doctor: string; payer: string; type: string; status: string; mode: string;
}
export const INV_FILTERS: [keyof InvFilters, string, (w: World) => string[]][] = [
  ["clinic", "Clinic", (w) => [...new Set(w.cases.map((c) => c.clinic))].sort()],
  ["doctor", "Doctor", (w) => [...new Set(w.cases.map((c) => c.doctor))].sort()],
  ["payer", "Payer type", () => ["Insurance", "Cash", "Internal"]],
  ["type", "Invoice type", () => ["Consultation", "Doctor's orders", "Package procedure", "Refund invoice"]],
  ["status", "Status", () => ["Paid", "On credit", "Refunded", "Replaced", "Void", "Refund"]],
  ["mode", "Payment mode", () => ["Cash", "Card", "Payment link", "Advance", "Credit"]],
];
export const defaultInvFilters = (): InvFilters => {
  const [from, to] = presetRange("today");
  return { preset: "today", from, to, clinic: "", doctor: "", payer: "", type: "", status: "", mode: "" };
};
/* what can be loaded: a date range, or — for any date — a search to narrow it */
export const invCanLoad = (f: InvFilters, q: string) => !!(q.trim() || (f.from && f.to));

export function queryInvoices(w: World, f: InvFilters, q: string) {
  q = (q || "").trim().toLowerCase();
  return allInvoices(w).filter(({ c, inv }) => {
    const p = pt(w, c);
    const i = inv as Invoice;
    if (q && !(inv.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.mrn.includes(q))) return false;
    const d = invDate(c, inv);
    if (f.from && d < f.from) return false;
    if (f.to && d > f.to) return false;
    if (f.clinic && c.clinic !== f.clinic) return false;
    if (f.doctor && c.doctor !== f.doctor) return false;
    if (f.payer && invPayerType(w, c, i) !== f.payer) return false;
    if (f.type && invType(i) !== f.type) return false;
    if (f.status && invStatus(i) !== f.status) return false;
    if (f.mode && invMode(i) !== f.mode) return false;
    return true;
  });
}

/* v3 pairInvoices() (line 4697): the patient's documents, paired by visit group — the first visit's invoices, then
   its follow-ups' and package procedures', each refund under the invoice it refunds; wallet documents with no visit last */
export type PairedRow =
  | { sep: { title: string; count: number; sub: Msg } }
  | (DocRow & { sep?: undefined; child: Msg | null });
export function pairInvoices(w: World, list: DocRow[]): PairedRow[] {
  const groups = new Map<number | "wallet", { root: Visit | null; items: DocRow[] }>();
  list.forEach((x) => {
    const real = x.c && x.c.id != null && w.cases.includes(x.c);
    const root = real ? rootVisit(w, x.c) : null;
    const key = root ? root.id : "wallet";
    if (!groups.has(key)) groups.set(key, { root, items: [] });
    groups.get(key)!.items.push(x);
  });
  const latest = (g: { items: DocRow[] }) => Math.max(0, ...g.items.map((x) => (x.c && x.c.sortKey) || 0));
  const out: PairedRow[] = [];
  [...groups.entries()].sort((a, b) => (a[0] === "wallet" ? 1 : b[0] === "wallet" ? -1 : latest(b[1]) - latest(a[1]))).forEach(([, g]) => {
    const visits = [...new Set(g.items.map((x) => x.c))].sort((a, b) => (a === g.root ? -1 : b === g.root ? 1 : (a.sortKey || 0) - (b.sortKey || 0)));
    const net = round2(g.items.reduce((a, x) => a + (x.inv.kind === "refund" ? -(x.inv.patient || 0) : x.inv.kind === "wallet" ? 0 : x.inv.patient || 0), 0));
    out.push({ sep: g.root
      ? { title: `${visitNo(g.root)} · ${g.root.visitType} · ${g.root.clinic} · ${g.root.date}`, count: visits.length - 1,
          sub: { k: "invoices.groupSub", p: { count: g.items.length, net: fmt(net) } } }
      : { title: "", count: 0, sub: { k: "invoices.walletGroupSub", p: { count: g.items.length } } } });
    visits.forEach((v) => {
      const mine = g.items.filter((x) => x.c === v);
      const rel: Msg | null = v !== g.root && g.root ? { k: "invoices.rel", p: { rel: { k: `patient.rel.${relationTo(v)}` }, no: visitNo(parentVisit(w, v) || g.root) } } : null;
      const main = mine.filter((x) => !x.inv.kind).sort((a, b) => (a.inv.at || "").localeCompare(b.inv.at || ""));
      const placed = new Set<DocRow>();
      main.forEach((x) => {
        out.push({ ...x, child: rel }); placed.add(x);
        mine.filter((r) => r.inv.kind === "refund" && (r.inv as Invoice & { refOf?: string }).refOf === x.inv.id)
          .forEach((r) => { out.push({ ...r, child: { k: "invoices.refundOf", p: { id: x.inv.id } } }); placed.add(r); });
      });
      mine.filter((x) => !placed.has(x)).forEach((x) => out.push({ ...x,
        child: x.inv.kind === "refund" ? { k: "invoices.refundOf", p: { id: (x.inv as Invoice & { refOf?: string }).refOf || "" } }
          : rel || (x.inv.kind === "wallet" ? { k: "invoices.onThisVisit" } : null) }));
    });
  });
  return out;
}

/* v3 invFilterSummary() (line 4619) */
export function invFilterSummary(L: { f: InvFilters; q: string }): (string | Msg)[] {
  const f = L.f, bits: (string | Msg)[] = [];
  if (L.q) bits.push(`“${L.q}”`);
  bits.push(f.preset && f.preset !== "custom" ? { k: `invoices.preset.${f.preset}` } : `${f.from || "…"} → ${f.to || "…"}`);
  INV_FILTERS.forEach(([k]) => { if (f[k]) bits.push(String(f[k])); });
  return bits;
}

/* v3 lines 4825–4836: the profile's invoice card headline */
export function patientInvoiceSummary(w: World, mrn: string) {
  const list: DocRow[] = [];
  visitsOf(w, mrn).forEach((c) => visitDocs(c).forEach((inv) => list.push({ c, inv })));
  const docs = w.patients[mrn]!.walletDocs || [];
  [...docs].reverse().forEach((d) => list.push({ c: walletDocVisit(w, d), inv: d }));
  const paid = round2(list.filter((i) => i.inv.paid).reduce((a, i) => a + (i.inv.patient || 0) - refundedOf(i.inv), 0));
  const onCredit = round2(list.filter((i) => i.inv.via === "Credit" && !i.inv.settled).reduce((a, i) => a + (i.inv.patient || 0), 0));
  return { list, count: list.length, walletDocs: docs.length, paid, onCredit };
}
