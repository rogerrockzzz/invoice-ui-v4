import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import i18n, { type Lang } from "../i18n";
import { resolveMsg } from "../i18n/msg";
import { drawerVisit, newDrawer, type DrawerExtra, type DrawerState, type DrawerToast } from "../domain/drawer";
import { defaultInvFilters, invCanLoad, queryInvoices, type InvFilters } from "../domain/invoices";
import { now } from "../domain/clock";
import type { AdvCat, PayerDecision, PayerDraft, Visit, World } from "../domain/types";
import type { WalletDone } from "./wallet";
import { openedVisit } from "./actions";
import { findInvoice } from "../domain/lookup";
import { refundStart, type RefundUi } from "../domain/refund";
import { openRefundOn } from "./refund";
import { openReplaceOn } from "./replace";
import { invoiceReplace, type ReplaceTo } from "../domain/replace";
import { notify } from "./toasts";
import { useWorld } from "./world";

export type Screen = "home" | "patient" | "visit" | "invoices";
export type Theme = "light" | "dark";
export type PendView = "today" | "upcoming" | "past";

const stored = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
};

/* What v3 keeps in its global `state` (line 1222) — screen, tabs and per-screen view state. */
export interface UiState {
  screen: Screen;
  tabs: string[];
  activeMrn: string | null;
  caseId: number | null;
  q: string;
  homeSel: string | null;
  homePanel: "pending" | "walkin" | null;
  walletOpen: boolean;
  profPendOpen: boolean;
  pendView: PendView;
  profVisitsOpen: boolean;
  vf: { no: string; from: string; to: string };
  visGroup: boolean;
  pinvOpen: boolean;
  pkgOpen: boolean;
  /* the payment pop-up, the event and invoice pop-ups, the visit history and the Simulate panel */
  drawer: DrawerState | null;
  eventPop: { caseId: number; i: number } | null;
  invPop: string | null;
  histOpen: boolean;
  comment: { cid: number; text: string; important: boolean } | null;
  simOpen: boolean;
  /* the refund being worked in its visit's Refund story (v3 state.refund) */
  refund: RefundUi | null;
  /* the replacement being worked in its visit's Replace story (v3 state.replace) */
  replace: ReplaceUi | null;
  /* the wallet section and its stories (v3 state.wallet / state.adv) */
  wallet: WalletUi | null;
  adv: AdvUi | null;
  /* the profile's payer flow and the walk-in (v3 state.profPayer / state.walkin) */
  profPayer: ProfPayerUi | null;
  walkin: WalkinUi | null;
  /* the Invoices screen (v3 state.invF / invQ / invLoaded / invEdit) and the profile's invoice pairing */
  invF: InvFilters;
  invQ: string;
  invLoaded: { f: InvFilters; q: string; at: string; ids: string[] } | null;
  invEdit: boolean;
  invGroup: boolean;
  theme: Theme;
  lang: Lang;

  openPatient: (mrn: string) => void;
  openVisit: (id: number, mrn: string) => void;
  closeTab: (mrn: string) => void;
  goHome: () => void;
  openInvoices: () => void;
  openDrawer: (caseId: number | null, mrn: string, amount: number, extra?: DrawerExtra) => void;
  drawerDo: (fn: (d: DrawerState, w: World, c: Visit) => DrawerToast | null | void) => void;
  set: (patch: Partial<Omit<UiState, Fns>>) => void;
  upd: (fn: (s: UiState) => void) => void;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  reset: () => void;
}
type Fns = "openPatient" | "openVisit" | "closeTab" | "goHome" | "openInvoices" | "openDrawer" | "drawerDo" | "set" | "upd" | "setTheme" | "setLang" | "reset";

export interface WalletUi {
  mrn: string; tab: "ADV" | "CREDIT"; flow: "add" | "refund" | "settle" | null; stmt: boolean;
  cat: AdvCat; amount: number | null; reason: string; sel: Record<string, boolean> | null; done: WalletDone | null;
}
export interface AdvUi { caseId: number | null; mrn: string; cat: AdvCat; amount: number | null; mode: string; fromWallet: boolean }
export interface ProfPayerUi { mrn: string; decision: PayerDecision | null; apply: Record<number, boolean>; pctx: PayerDraft }
export interface WalkinUi {
  stage: number; mrn: string; type: string; clinic: string; doctor: string; slot: string | null;
  cart: { sel: Record<string, boolean>; q: string }; pctx: PayerDraft | null; payerDecision: PayerDecision | null; createdId: number | null;
}

const initial = () => ({
  screen: "home" as Screen, tabs: [] as string[], activeMrn: null, caseId: null, q: "", homeSel: null, homePanel: null,
  walletOpen: false, profPendOpen: true, pendView: "today" as PendView, profVisitsOpen: true, vf: { no: "", from: "", to: "" },
  visGroup: false, pinvOpen: false, pkgOpen: false,
  drawer: null, eventPop: null, invPop: null, histOpen: true, comment: null, simOpen: false, refund: null as RefundUi | null, replace: null as ReplaceUi | null,
  wallet: null, adv: null, profPayer: null, walkin: null,
  invF: defaultInvFilters(), invQ: "", invLoaded: null, invEdit: false, invGroup: false,
});

export const useUi = create<UiState>()(
  immer((set) => ({
    ...initial(),
    theme: stored("vida.theme", ["light", "dark"] as const, "light"),
    lang: stored("vida.lang", ["en", "ar"] as const, "en"),

    /* v3 openPatient() (line 3391): several patients can be open at once */
    openPatient: (mrn) => set((s) => {
      if (!s.tabs.includes(mrn)) s.tabs.push(mrn);
      dropInline(s);
      s.activeMrn = mrn; s.caseId = null; s.screen = "patient";
    }),
    /* v3 openVisit() (line 3397): a visit always opens on its main story */
    openVisit: (id, mrn) => {
      useWorld.getState().act(id, (w, c) => openedVisit(w, c));
      set((s) => {
        if (!s.tabs.includes(mrn)) s.tabs.push(mrn);
        if (s.caseId !== id) dropInline(s);
        s.activeMrn = mrn; s.caseId = id; s.screen = "visit";
      });
    },
    /* v3 closeTab() (line 3407) */
    closeTab: (mrn) => set((s) => {
      s.tabs = s.tabs.filter((m) => m !== mrn);
      if (s.activeMrn === mrn) {
        const next = s.tabs[s.tabs.length - 1];
        if (next) { s.activeMrn = next; s.caseId = null; s.screen = "patient"; }
        else { s.activeMrn = null; s.caseId = null; s.screen = "home"; }
      }
    }),
    goHome: () => set((s) => { dropInline(s); s.screen = "home"; s.activeMrn = null; s.caseId = null; }),
    /* v3 renderTabs(): the Invoices screen always opens asking what to load */
    openInvoices: () => set((s) => { s.screen = "invoices"; s.invLoaded = null; s.invEdit = false; s.invQ = ""; s.invF = defaultInvFilters(); }),
    /* v3 `state.drawer = { c, mode:"Cash", amount }` — the desk opens on cash */
    openDrawer: (caseId, mrn, amount, extra) => set((s) => { s.drawer = newDrawer(caseId, mrn, amount, extra); }),
    drawerDo: (fn) => {
      let out: DrawerToast | null | void = null;
      const w = useWorld.getState();
      set((s) => {
        if (!s.drawer) return;
        out = fn(s.drawer, w, drawerVisit(w, s.drawer));
      });
      const tst = out as DrawerToast | null;
      if (tst) notify(tst.kind, resolveMsg(i18n.t, tst.title), tst.sub ? resolveMsg(i18n.t, tst.sub) : undefined);
    },
    set: (patch) => set((s) => { Object.assign(s, patch); }),
    upd: (fn) => set((s) => { fn(s); }),
    setTheme: (t) => set((s) => { s.theme = t; try { localStorage.setItem("vida.theme", t); } catch { /* private mode */ } }),
    setLang: (l) => set((s) => { s.lang = l; try { localStorage.setItem("vida.lang", l); } catch { /* private mode */ } }),
    reset: () => set((s) => { Object.assign(s, initial()); }),
  })),
);

/* v3 dropInlineRefund() (line 3417): work started inside a visit's story does not follow you out of the visit */
function dropInline(s: UiState) {
  if (s.screen === "visit") { s.refund = null; s.replace = null; }
}

/* v3 invoiceReplace().open (lines 1507, 1516): replace this invoice only, onto the payer chosen for it */
export interface ReplaceUi { caseId: number; to: ReplaceTo; payerId: string; codes: string[]; partial: boolean }
export function openReplace(c: Visit, invId: string) {
  const w = useWorld.getState();
  const inv = c.invoices.find((i) => i.id === invId);
  const r = inv && invoiceReplace(w, c, inv);
  if (!r) return;
  useWorld.getState().act(c.id, (_w, dc) => openReplaceOn(dc));
  useUi.getState().set({ replace: { caseId: c.id, to: "insurance", payerId: r.payerId, codes: [c.consult, ...c.orders].filter((l) => l.invoiceId === invId).map((l) => l.code), partial: true } });
}

/* v3 openRefund() (line 5192): a refund always happens in its visit's Refund story — wherever it was started from,
   the receptionist lands on the visit and sees what they are refunding against */
export function openRefund(id: string) {
  const w = useWorld.getState();
  const hit = findInvoice(w, id);
  const r = refundStart(w, id);
  if (!hit || !r) return;
  const ui = useUi.getState();
  ui.set({ invPop: null, eventPop: null });
  if (ui.screen !== "visit" || ui.caseId !== hit.c.id) ui.openVisit(hit.c.id, hit.c.mrn);
  useWorld.getState().act(hit.c.id, openRefundOn);
  useUi.getState().set({ refund: r });
}

/* v3 walletState() (line 4167): the wallet section's own state, for the patient in view */
export const freshWallet = (mrn: string): WalletUi => ({ mrn, tab: "ADV", flow: null, stmt: false, cat: "Open", amount: null, reason: "", sel: null, done: null });
export const walletOn = (s: UiState, mrn: string) => (s.wallet && s.wallet.mrn === mrn ? s.wallet : freshWallet(mrn));
export function walletDo(mrn: string, fn: (ws: WalletUi) => void) {
  useUi.getState().upd((s) => {
    if (!s.wallet || s.wallet.mrn !== mrn) s.wallet = freshWallet(mrn);
    fn(s.wallet);
  });
}

/* v3 loadInvoices() (line 4604): retrieve — only now are invoices fetched */
export function loadInvoices(f?: Partial<InvFilters> | null, q?: string) {
  const ui = useUi.getState();
  const ff = { ...ui.invF, ...(f || {}) };
  const qq = q !== undefined ? q : ui.invQ;
  ui.upd((s) => { s.invF = ff; s.invQ = qq; });
  if (!invCanLoad(ff, qq || "")) { notify("warn", i18n.t("toast.narrowFirst"), i18n.t("toast.narrowFirstSub")); return; }
  const rows = queryInvoices(useWorld.getState(), ff, qq);
  ui.upd((s) => { s.invLoaded = { f: { ...ff }, q: qq || "", at: now(), ids: rows.map((r) => r.inv.id) }; s.invEdit = false; s.screen = "invoices"; s.invPop = null; s.eventPop = null; });
}
/* v3 openInvoicesFor() (line 4614): the screen already loaded for one patient, any date */
export function openInvoicesFor(mrn: string) {
  useUi.getState().set({ invF: { ...defaultInvFilters(), preset: "any", from: "", to: "" } });
  loadInvoices(null, mrn);
}
