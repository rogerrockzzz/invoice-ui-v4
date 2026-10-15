import { ADV_CATS, modeLabel, payMode, PAY_MODES, REFUND_MODES, secondMode } from "./constants";
import { noteLabel, notesTotal, suggestNotes } from "./cash";
import { walletOf } from "./lookup";
import { fmt, round2 } from "./money";
import type { AdvCat, Msg, Visit, World } from "./types";

/* The payment pop-up (v3 lines 5490–5871, payment branch). A payment is built up one mode at a time:
   what has been taken already is fixed, and the mode chips at the top drive the part being entered now. */

export interface PayPart {
  mode: string;
  amount: number;
  ref?: string;
  ref2?: string;
  tendered?: number | null;
  notes?: Record<number, number> | null;
  manual?: boolean;
}

export interface DrawerState {
  /* the visit it was opened on; a wallet opened on a patient with no visit has none */
  caseId: number | null;
  mrn: string;
  /* settling credit invoices picked earlier (v3 d.credit) / unused advance back to the patient (v3 d.advRefund) */
  credit?: { ids: string[]; fromWallet?: boolean } | null;
  advRefund?: { cat: AdvCat; reason: string } | null;
  /* money back on an invoice (v3 d.refund) / the overpayment a replacement leaves (v3 d.refundDiff) */
  refund?: { id: string; codes: string[]; reason: string; dedBack: number } | null;
  refundDiff?: { reason: string; to: string } | null;
  mode: string;
  amount: number;
  parts: PayPart[];
  notes: Record<number, number> | null;
  notesFor: number | null;
  tenderManual: string | null;
  partAmt: number | null;
  ref: string;
  ref2: string;
  moreOpen: boolean;
  editing: string | null;
}

/* what a drawer interaction tells the receptionist */
export interface DrawerToast { kind: "ok" | "warn" | ""; title: Msg; sub?: Msg }

export function newDrawer(caseId: number | null, mrn: string, amount: number, extra: DrawerExtra = {}, mode = "Cash"): DrawerState {
  const d: DrawerState = {
    caseId, mrn, ...extra, mode, amount: round2(amount), parts: [], notes: null, notesFor: null, tenderManual: null, partAmt: null,
    ref: "", ref2: "", moreOpen: false, editing: null,
  };
  normalizeDrawer(d);
  return d;
}
/* money going back, and credit settlement, are a single part with no split and no notes (v3 line 5528) */
export const isMoneyBack = (d: DrawerState) => !!(d.refund || d.refundDiff || d.advRefund);
export type DrawerExtra = Pick<DrawerState, "credit" | "advRefund" | "refund" | "refundDiff">;
export const isSimple = (d: DrawerState) => isMoneyBack(d) || !!d.credit;
/* the visit the drawer acts on — or, for a patient with no visit, a stand-in that carries the MRN */
export const drawerVisit = (w: World, d: DrawerState): Visit =>
  w.cases.find((x) => x.id === d.caseId) || ({ id: null, mrn: d.mrn, history: [], invoices: [], orders: [] } as unknown as Visit);

export const payTaken = (d: DrawerState) => d.parts;
export const payAllocated = (d: DrawerState) => round2(payTaken(d).reduce((a, p) => a + p.amount, 0));
export const payRemaining = (d: DrawerState) => round2(d.amount - payAllocated(d));

/* v3 payTendered() resets the notes to the usual ones whenever what is left changes. It does so while
   rendering; v4 does it after every change to the drawer, which reaches the same state. */
export function normalizeDrawer(d: DrawerState) {
  if (d.mode !== "Cash" || isSimple(d)) return d;
  const left = payRemaining(d);
  if (d.notesFor !== left) {
    d.notes = suggestNotes(left);
    d.notesFor = left;
    d.tenderManual = null;
  }
  return d;
}
/* the cash in hand is what the notes add up to; other modes take whatever is typed */
export function payTendered(d: DrawerState): number | null {
  if (d.mode !== "Cash") return null;
  return d.tenderManual != null ? parseFloat(d.tenderManual) || 0 : notesTotal(d.notes);
}
export function payActive(d: DrawerState): PayPart | null {
  const left = payRemaining(d);
  if (left <= 0.004) return null; /* everything is already allocated */
  const amount = d.mode === "Cash"
    ? Math.min(left, payTendered(d)!) /* cash covers only what was handed over */
    : d.partAmt != null ? Math.max(0, Math.min(left, d.partAmt)) : left;
  return { mode: d.mode, amount: round2(amount), ref: d.ref || "", ref2: d.ref2 || "" };
}
export function payParts(d: DrawerState): PayPart[] {
  const act = payActive(d);
  return [...payTaken(d), ...(act && act.amount > 0.004 ? [act] : [])];
}
export const partsLabel = (parts: PayPart[]) => parts.map((p) => modeLabel(p.mode)).join(" + ");

/* how much of a pot a split is trying to draw, so it can be checked against the wallet */
export function advShortfall(w: World, c: Visit, parts: PayPart[]) {
  const wal = walletOf(w, c);
  const want: Partial<Record<AdvCat, number>> = {};
  parts.forEach((p) => {
    const m = payMode(p.mode);
    if (m.advance) want[m.advance] = round2((want[m.advance] || 0) + p.amount);
  });
  return (Object.entries(want) as [AdvCat, number][])
    .filter(([k, v]) => v > wal.advance[k] + 0.004)
    .map(([k, v]) => ({ cat: k, want: v, has: wal.advance[k] }));
}

/* everything the drawer shows, derived from its state (v3 renderDrawer, lines 5526–5546) */
export function drawerView(w: World, c: Visit, d: DrawerState) {
  const wal = walletOf(w, c);
  const back = isMoneyBack(d), simple = isSimple(d);
  const parts = simple ? [{ mode: d.mode, amount: d.amount, ref: d.ref, ref2: d.ref2 }] : payParts(d);
  const taken = simple ? [] : payTaken(d);
  const left = simple ? d.amount : payRemaining(d);
  const active = simple ? null : payActive(d);
  const activeAmt = active ? active.amount : 0;
  const unallocated = simple ? 0 : round2(left - activeAmt);
  const short = back ? [] : advShortfall(w, c, parts);
  const tendered = !simple && d.mode === "Cash" ? payTendered(d)! : 0;
  const change = !simple && d.mode === "Cash" ? round2(tendered - activeAmt) : 0;
  /* an advance mode is offered up front only when that pot actually holds money; credit cannot settle credit */
  const offered = PAY_MODES.filter((m) => !(d.credit && m.id === "Credit"));
  const shown = offered.filter((m) => m.top || (m.advance && wal.advance[m.advance] > 0));
  const rest = offered.filter((m) => !shown.includes(m));
  const advParts = back ? [] : parts.filter((p) => payMode(p.mode).advance);
  const advTotal = ADV_CATS.reduce((a, k) => a + wal.advance[k], 0);
  return {
    parts, taken, left, active, activeAmt, unallocated, short, shortAdv: short.length > 0, tendered, change,
    back, simple, refundModes: REFUND_MODES.filter((m) => !(d.advRefund && m === "Advance wallet")),
    shown, rest, restOn: rest.some((m) => m.id === d.mode), advParts,
    walletAfter: advTotal - advParts.reduce((a, p) => a + p.amount, 0),
    canConfirm: back || (!short.length && unallocated <= 0.004),
    totalLabel: (back ? "toRefund" : parts.every((p) => p.mode === "Credit") ? "toCredit" : parts.some((p) => p.mode === "Credit") ? "toCollectAndCredit" : "toCollect") as
      "toRefund" | "toCredit" | "toCollectAndCredit" | "toCollect",
    head: d.advRefund ? "advRefund" : d.refund || d.refundDiff ? "refund" : d.credit ? "credit" : "payment",
    goLabel: confirmLabel(d, parts),
  };
}

/* the confirm button says what will happen (v3 line 5690) */
function confirmLabel(d: DrawerState, parts: PayPart[]): Msg {
  if (isMoneyBack(d)) return { k: "drawer.go.refund", p: { mode: modeLabel(d.mode).toLowerCase() } };
  if (parts.length === 1 && parts[0]!.mode === "Credit") return { k: "drawer.go.credit" };
  if (parts.length > 1) return { k: "drawer.go.parts", p: { count: parts.length } };
  const adv = payMode(d.mode).advance;
  if (adv) return { k: "drawer.go.advance", p: { pot: adv.toLowerCase() } };
  return { k: "drawer.go.mode", p: { mode: modeLabel(d.mode).toLowerCase() } };
}

/* ---- what each control does (v3 lines 5698–5782) ---- */
export function pickMode(w: World, c: Visit, d: DrawerState, id: string): DrawerToast | null {
  const meta = payMode(id);
  if (meta.advance && walletOf(w, c).advance[meta.advance] <= 0 && !isMoneyBack(d))
    return { kind: "warn", title: { k: "toast.noAdvance", p: { pot: meta.advance.toLowerCase() } }, sub: { k: "toast.noAdvanceSub" } };
  d.mode = id;
  d.moreOpen = false;
  d.notesFor = null;
  normalizeDrawer(d);
  return null;
}
export function setPartAmount(d: DrawerState, value: number): DrawerToast | null {
  const left = payRemaining(d);
  const want = Math.max(0, value || 0);
  d.partAmt = round2(Math.min(want, left));
  normalizeDrawer(d);
  return want > left + 0.004 ? { kind: "warn", title: { k: "toast.onlyLeft", p: { amount: fmt(left) } }, sub: { k: "toast.onlyLeftSub" } } : null;
}
/* take this part and move on to the next mode — the commonest partner is pre-selected */
export function addPart(w: World, c: Visit, d: DrawerState): DrawerToast {
  const act = payActive(d);
  if (!act || act.amount <= 0.004) return { kind: "warn", title: { k: "toast.nothingToAdd" }, sub: { k: "toast.nothingToAddSub" } };
  const sh = advShortfall(w, c, [...payTaken(d), act]);
  if (sh.length) return { kind: "warn", title: { k: "toast.notEnoughPot", p: { pot: sh[0]!.cat.toLowerCase() } }, sub: { k: "toast.onWallet", p: { amount: fmt(sh[0]!.has) } } };
  const tendered = d.mode === "Cash" ? payTendered(d) : null;
  d.parts.push({ ...act, tendered, notes: d.mode === "Cash" ? { ...(d.notes || {}) } : null, manual: d.tenderManual != null });
  d.editing = null;
  d.mode = secondMode(act.mode);
  d.partAmt = null; d.ref = ""; d.ref2 = ""; d.notes = null; d.notesFor = null; d.tenderManual = null;
  d.moreOpen = false;
  normalizeDrawer(d);
  return { kind: "", title: { k: "toast.partAdded", p: { mode: modeLabel(act.mode), amount: fmt(act.amount) } }, sub: { k: "toast.leftToPay", p: { amount: fmt(payRemaining(d)) } } };
}
/* clicking a taken payment pulls it back into the editor, exactly as it was */
export function editPart(d: DrawerState, i: number) {
  const tp = d.parts.splice(i, 1)[0];
  if (!tp) return;
  d.mode = tp.mode; d.ref = tp.ref || ""; d.ref2 = tp.ref2 || "";
  d.partAmt = tp.mode === "Cash" ? null : tp.amount;
  d.notes = tp.notes ? { ...tp.notes } : null;
  d.notesFor = tp.notes ? payRemaining(d) : null;
  d.tenderManual = tp.manual ? String(tp.tendered) : null;
  d.editing = tp.mode;
  normalizeDrawer(d);
}
export function removePart(d: DrawerState, i: number) {
  const gone = d.parts.splice(i, 1)[0];
  d.partAmt = null; d.notesFor = null; d.tenderManual = null; d.editing = null;
  if (gone) d.mode = gone.mode; /* back to the mode that was removed */
  normalizeDrawer(d);
}
export function addNote(d: DrawerState, n: number) {
  d.notes = { ...(d.notes || {}) };
  d.notes[n] = (d.notes[n] || 0) + 1;
  d.notesFor = payRemaining(d);
  d.tenderManual = null; /* back to counting notes */
}
export function lessNote(d: DrawerState, n: number) {
  if (!d.notes || !d.notes[n]) return;
  const k = d.notes[n] - 1;
  d.notes = { ...d.notes, [n]: k };
  if (!k) delete d.notes[n];
  d.notesFor = payRemaining(d);
  d.tenderManual = null;
}
export function usualNotes(d: DrawerState) {
  const left = payRemaining(d);
  d.notes = suggestNotes(left); d.notesFor = left; d.tenderManual = null;
}
export function clearNotes(d: DrawerState) {
  d.notes = {}; d.notesFor = payRemaining(d); d.tenderManual = null;
}
export function setTendered(d: DrawerState, v: string) {
  d.tenderManual = v;
}

/* what the confirm button hands to payAll: the mode label, the detail line and the parts (v3 lines 5789–5798) */
export function drawerConfirm(d: DrawerState) {
  let detail = [d.ref2, d.ref].filter(Boolean).join(" · ");
  if (isSimple(d)) return { mode: d.mode, detail, parts: [{ mode: d.mode, amount: d.amount, ref: d.ref, ref2: d.ref2 }] };
  const parts = payParts(d);
  const mode = partsLabel(parts);
  const tendered = d.mode === "Cash" ? payTendered(d)! : 0;
  if (d.mode === "Cash" && tendered > 0) {
    const act = payActive(d);
    const change = round2(tendered - (act ? act.amount : 0));
    const counted = Object.entries(d.notes || {}).filter(([, k]) => k > 0)
      .sort((a, b) => +b[0] - +a[0]).map(([n, k]) => `${k}×${noteLabel(+n)}`).join(" + ");
    detail = `tendered ${fmt(tendered)}${counted && d.tenderManual == null ? ` (${counted})` : ""}${change > 0.004 ? ` · change ${fmt(change)}` : ""}`;
  }
  if (parts.length > 1) detail = [parts.map((p) => `${modeLabel(p.mode)} ${fmt(p.amount)}`).join(" + "), detail].filter(Boolean).join(" · ");
  return { mode, detail, parts };
}
