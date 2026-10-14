import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createWorld } from "../data/world";
import { USER } from "../domain/constants";
import { now } from "../domain/clock";
import { nextLedgerKey } from "../domain/ids";
import { makeWalletDoc } from "../domain/ledger";
import type { HistoryEvent, LedgerEntry, Visit, World } from "../domain/types";

/* The v3 world (patients, visits, settings) plus the actions that change it. Actions mutate an immer
   draft, so v3's mutating logic ports line for line. */
export interface WorldStore extends World {
  reset: () => void;
  setBranch: (branch: string) => void;
  record: (caseId: number, ic: string, tx: string, sub: string, meta?: Partial<HistoryEvent>) => void;
  addComment: (caseId: number, text: string, important?: boolean) => void;
  logLedger: (mrn: string, e: Omit<LedgerEntry, "at"> & Partial<Pick<LedgerEntry, "at">>) => void;
}

/* v3 record() (line 1599) — newest first */
export function recordOn(c: Visit, ic: string, tx: string, sub: string, meta?: Partial<HistoryEvent>) {
  c.history.unshift({ at: now(), ic, tx, sub: sub || "", by: USER, type: "", ...(meta || {}) } as HistoryEvent);
}

/* v3 logLedger() (line 1546) */
export function logLedgerOn(w: World, mrn: string, e: Omit<LedgerEntry, "at"> & Partial<Pick<LedgerEntry, "at">>) {
  const p = w.patients[mrn]!;
  p.ledger = p.ledger || [];
  const entry: LedgerEntry = { at: now(), date: "Today", by: USER, k: nextLedgerKey(), ...e };
  p.ledger.unshift(entry);
  makeWalletDoc(w, mrn, entry);
}

export const useWorld = create<WorldStore>()(
  immer((set) => ({
    ...createWorld(),
    reset: () => set(() => ({ ...createWorld() })),
    setBranch: (branch) => set((s) => { s.settings.branch = branch; }),
    record: (caseId, ic, tx, sub, meta) => set((s) => {
      const c = s.cases.find((x) => x.id === caseId);
      if (c) recordOn(c, ic, tx, sub, meta);
    }),
    /* v3 addComment() (line 4359); the comment is stored as plain text, never as markup. Toast: the UI (1b). */
    addComment: (caseId, text, important) => set((s) => {
      const c = s.cases.find((x) => x.id === caseId);
      if (c && text.trim()) recordOn(c, "c", text.trim(), "", { type: "COMMENT", important: !!important, plain: true });
    }),
    logLedger: (mrn, e) => set((s) => { logLedgerOn(s, mrn, e); }),
  })),
);

/* the plain world, for domain functions */
export const worldOf = (s: WorldStore): World => s;
