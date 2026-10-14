import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Lang } from "../i18n";

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
  theme: Theme;
  lang: Lang;

  openPatient: (mrn: string) => void;
  openVisit: (id: number, mrn: string) => void;
  closeTab: (mrn: string) => void;
  goHome: () => void;
  openInvoices: () => void;
  set: (patch: Partial<Omit<UiState, Fns>>) => void;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  reset: () => void;
}
type Fns = "openPatient" | "openVisit" | "closeTab" | "goHome" | "openInvoices" | "set" | "setTheme" | "setLang" | "reset";

const initial = () => ({
  screen: "home" as Screen, tabs: [] as string[], activeMrn: null, caseId: null, q: "", homeSel: null, homePanel: null,
  walletOpen: false, profPendOpen: true, pendView: "today" as PendView, profVisitsOpen: true, vf: { no: "", from: "", to: "" },
  visGroup: false, pinvOpen: false, pkgOpen: false,
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
    /* v3 openVisit() (line 3397); resetting the visit's active story happens in the world store (1b) */
    openVisit: (id, mrn) => set((s) => {
      if (!s.tabs.includes(mrn)) s.tabs.push(mrn);
      s.activeMrn = mrn; s.caseId = id; s.screen = "visit";
    }),
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
    set: (patch) => set((s) => { Object.assign(s, patch); }),
    setTheme: (t) => set((s) => { s.theme = t; try { localStorage.setItem("vida.theme", t); } catch { /* private mode */ } }),
    setLang: (l) => set((s) => { s.lang = l; try { localStorage.setItem("vida.lang", l); } catch { /* private mode */ } }),
    reset: () => set((s) => { Object.assign(s, initial()); }),
  })),
);
