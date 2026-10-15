import { CASH_PAYER, MONTHS } from "./constants";
import { today } from "./clock";
import { payerOf, visitsOf } from "./lookup";
import type { Patient, Payer, Visit, World } from "./types";

/* v3 lines 3231–3260 */
export const isToday = (c: Visit) => c.date === "Today";
export const isFuture = (c: Visit) => !!c.future;

/* The visit a visit belongs to: an explicit link, the visit that paid for the package, or — for a
   follow-up — the latest earlier consultation in the same clinic. */
export function parentVisit(w: World, c: Visit): Visit | null {
  if (c.parentId) return w.cases.find((x) => x.id === c.parentId) || null;
  if (c.fromPackage) {
    const src = (c.orders || []).find((o) => o.fromPackage)?.fromPackage;
    return src ? w.cases.find((x) => x.id === src.visitId) || null : null;
  }
  if (c.visitType === "Follow-up")
    return (
      w.cases
        .filter((x) => x.mrn === c.mrn && x.id !== c.id && x.clinic === c.clinic && x.visitType === "Consultation" && (x.sortKey || 0) < (c.sortKey || 0))
        .sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0))[0] || null
    );
  return null;
}
export function rootVisit(w: World, c: Visit): Visit {
  let r = c;
  const seen = new Set([c.id]);
  for (let p = parentVisit(w, r); p && !seen.has(p.id); p = parentVisit(w, r)) {
    seen.add(p.id);
    r = p;
  }
  return r;
}
export type Relation = "package" | "followup" | "linked";
export const relationTo = (c: Visit): Relation => (c.fromPackage ? "package" : c.visitType === "Follow-up" ? "followup" : "linked");

/* a visit number the receptionist can quote, and a real date to filter on */
export const visitNo = (c: Visit) => "V" + String(100000 + c.id);
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function visitDate(c: Visit) {
  const t = today();
  t.setHours(0, 0, 0, 0);
  let d = t;
  const m = /^(\d{1,2}) (\w{3})$/.exec(c.date || "");
  if (m && MONTHS[m[2]!] !== undefined) d = new Date(t.getFullYear(), MONTHS[m[2]!]!, +m[1]!);
  return isoDay(d);
}

/* v3 lines 3988–4004: the doctor's free 15-minute slots from now until the clinic closes. A slot is taken if a
   visit today already holds it, or the doctor's schedule has it booked (simulated, the same every time for a doctor). */
export const CLINIC_CLOSE = 20 * 60;
export const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export function freeSlots(w: World, doctor: string) {
  const t = today();
  const from = Math.ceil((t.getHours() * 60 + t.getMinutes() + 5) / 15) * 15;
  const held = new Set(w.cases.filter((c) => c.doctor === doctor && isToday(c) && c.slot).map((c) => c.slot));
  const seed = [...doctor].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const out: string[] = [];
  for (let m = Math.max(from, 8 * 60); m < CLINIC_CLOSE; m += 15) {
    const s = hhmm(m);
    if (held.has(s) || (seed + m / 15) % 3 === 0) continue; /* booked */
    out.push(s);
  }
  return out;
}

/* v3 lines 4031–4037: the payer in force right now — taken from the latest visit on file */
export function activePayerOf(w: World, p: Patient): { payer: Payer; from: { kind: "profile" | "open" | "last"; date?: string; at?: string } | null } {
  const vs = visitsOf(w, p.mrn);
  const cur = vs.find((x) => !x.closed && !x.future) || vs.find((x) => !x.closed) || vs[0];
  if (p.activePayerId) return { payer: p.payers.find((x) => x.id === p.activePayerId) || CASH_PAYER, from: { kind: "profile" } };
  return {
    payer: cur ? payerOf(w, cur) : p.payers[0] || CASH_PAYER,
    from: cur ? { kind: cur.closed ? "last" : "open", date: cur.date, at: cur.arrived } : null,
  };
}
