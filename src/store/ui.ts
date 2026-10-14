import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import i18n, { type Lang } from "../i18n";
import { resolveMsg } from "../i18n/msg";
import { newDrawer, type DrawerState, type DrawerToast } from "../domain/drawer";
import type { Visit, World } from "../domain/types";
import { openedVisit } from "./actions";
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
  theme: Theme;
  lang: Lang;

  openPatient: (mrn: string) => void;
  openVisit: (id: number, mrn: string) => void;
  closeTab: (mrn: string) => void;
  goHome: () => void;
  openInvoices: () => void;
  openDrawer: (caseId: number, amount: number) => void;
  drawerDo: (fn: (d: DrawerState, w: World, c: Visit) => DrawerToast | null | void) => void;
  set: (patch: Partial<Omit<UiState, Fns>>) => void;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  reset: () => void;
}
type Fns = "openPatient" | "openVisit" | "closeTab" | "goHome" | "openInvoices" | "openDrawer" | "drawerDo" | "set" | "setTheme" | "setLang" | "reset";

const initial = () => ({
  screen: "home" as Screen, tabs: [] as string[], activeMrn: null, caseId: null, q: "", homeSel: null, homePanel: null,
  walletOpen: false, profPendOpen: true, pendView: "today" as PendView, profVisitsOpen: true, vf: { no: "", from: "", to: "" },
  visGroup: false, pinvOpen: false, pkgOpen: false,
  drawer: null, eventPop: null, invPop: null, histOpen: true, comment: null, simOpen: false,
});

export const useUi = create<UiState>()(
  immer((set) => ({
    ...initial(),
    theme: stored("vida.theme", ["light", "dark"] as const, "light"),
    lang: stored("vida.lang", ["en", "ar"] as const, "en"),

    /* v3 openPatient() (line 3391): several patients can be open at once */
    openPatient: (mrn) => set((s) => {
      if (!s.tabs.includes(mrn)) s.tabs.push(mrn);
      s.activeMrn = mrn; s.caseId = null; s.screen = "patient";
    }),
    /* v3 openVisit() (line 3397): a visit always opens on its main story */
    openVisit: (id, mrn) => {
      useWorld.getState().act(id, (w, c) => openedVisit(w, c));
      set((s) => {
        if (!s.tabs.includes(mrn)) s.tabs.push(mrn);
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
    goHome: () => set((s) => { s.screen = "home"; s.activeMrn = null; s.caseId = null; }),
    /* v3 renderTabs(): the Invoices screen always opens asking what to load */
    openInvoices: () => set((s) => { s.screen = "invoices"; }),
    /* v3 `state.drawer = { c, mode:"Cash", amount }` — the desk opens on cash */
    openDrawer: (caseId, amount) => set((s) => { s.drawer = newDrawer(caseId, amount); }),
    drawerDo: (fn) => {
      let out: DrawerToast | null | void = null;
      const w = useWorld.getState();
      set((s) => {
        if (!s.drawer) return;
        const c = w.cases.find((x) => x.id === s.drawer!.caseId);
        if (c) out = fn(s.drawer, w, c);
      });
      const tst = out as DrawerToast | null;
      if (tst) notify(tst.kind, resolveMsg(i18n.t, tst.title), tst.sub ? resolveMsg(i18n.t, tst.sub) : undefined);
    },
    set: (patch) => set((s) => { Object.assign(s, patch); }),
    setTheme: (t) => set((s) => { s.theme = t; try { localStorage.setItem("vida.theme", t); } catch { /* private mode */ } }),
    setLang: (l) => set((s) => { s.lang = l; try { localStorage.setItem("vida.lang", l); } catch { /* private mode */ } }),
    reset: () => set((s) => { Object.assign(s, initial()); }),
  })),
);
