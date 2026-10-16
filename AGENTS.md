# VIDA OPD Billing v4 — agent notes

## Start here
- Plan for Milestone 1 (checkpoints 1a / 1b / 1c): `docs/PLAN-v4-M1.md` — read §0–§6, then your checkpoint.
- Milestone 2 (2a Add orders / 2b Refund / 2c Replace): `docs/PLAN-v4-M2.md` (done).
- Milestone 3 (3a LWBS / 3b Package booking / 3c Package procedure): `docs/PLAN-v4-M3.md`. M4 still to be planned.
- Progress and v3 drift: `docs/PARITY.md` (every v3 declaration → v4 module, checkpoint, status).
- UI library skill: `.devin/skills/heroui-react/` (HeroUI **v3** only). Fetch component docs before use:
  `node .devin/skills/heroui-react/scripts/get_component_docs.mjs <Component>`.
- v3 reference prototype (source of truth, still evolving): `docs/Devin Invoice UI/journey-opd-v3.html`
  (its own notes: `docs/Devin Invoice UI/AGENTS.md`).

## Commands
- `npm run dev` (5173) · `npm run build` · `npm run preview` (4173)
- `npm run test` — Vitest: domain goldens + basics
- `npm run test:e2e` — Playwright, projects `desktop` (1440×900) and `tablet` (1024×768); serves `vite preview`, so build first
- `npm run lint` — ESLint + RTL guard (`scripts/check-logical-css.mjs` bans ml-/mr-/pl-/pr-/left-/right-/text-left/…)
- `npm run golden` — regenerate `src/domain/__golden__/v3.json` from v3 (headless Chrome, no server needed)
- `npm run drift` — function-by-function diff of live v3 vs `docs/v3-baseline.html`; `-- --accept` after porting
- `npm run verify` — typecheck + lint + test + build + e2e (definition of done)

## Environment
- Node 22.22.1, system npm 9.2.0 — **npm 9 and npm 10 crash on install** (`Cannot read properties of null
  (reading 'edgesOut')`, optional-peer chain vite → @vitejs/devtools → vitest). Install with
  `npx -y npm@11.21.0 install …`. Plain `npm run …` is fine.
- Dependency policy: versions ≥ 7 days old, pinned exact. Transitive packages that were too new are pinned in
  `package.json` `overrides` — after adding or updating any dependency run `npm run deps:age` (must report 0).
- google-chrome headless and Playwright Chromium are installed. **No curl** — use wget or Node `fetch`.
- Port 8765 is taken by an older server for `/home/roger/Documents/Roger_BK/Devin Invoice UI` — leave it.

## Conventions and gotchas (learned in 1a)
- Domain (`src/domain`) is pure TS, keeps v3 function names, takes `w: World` first. Rounding is `round2 = +x.toFixed(2)`.
- Step texts are i18n keys with params; a param may be a nested `Msg` or `""`. Render with `<M msg>` / `<T k p>`
  (`src/ui/Rich.tsx`), which handles `<b>` and `<inv>` only. `en.json` holds v3's exact English — the goldens
  compare rendered text word for word, so do not reword `step.*` / `story.*` / `badge.*` / `lock.*` keys.
- Golden tests freeze the clock at `golden.generatedAt` (`setClock`) before `createWorld()`.
- HeroUI v3: `Dropdown` takes the `Button` directly (no `Dropdown.Trigger` around a Button — nested buttons).
  `Tooltip.Trigger` is itself `role="button"` — never put a Button inside; use `ui/ComingSoon.tsx` for disabled
  "Coming in …" entry points. `Disclosure.Indicator` has `ms-auto` — put it last and give it `ms-2`.
- Theme overrides in `src/theme.css` are unlayered and the light block matches `:root`, so every base colour set
  for light must be set again under `.dark`.
- `window.__vida = { reset, world, ui }` is always exposed (prototype, mock data) for e2e and demos.

## Learned in 1b
- v3's actions are in `src/store/actions.ts` (plain `(w, c, …, fx)` functions); UI runs them with
  `useWorld.getState().act(caseId, fn)` so they mutate an immer draft and toasts fire after the commit.
  `nextStep` action ids map to them in `src/store/stepActions.ts` (`STEP_LATER` = disabled "Coming in …").
- Scripted golden flows: add ops to `FLOWS` in `tools/v3-golden/extract.html`, run `npm run golden`; the v4 replay is
  `src/store/__tests__/flows.test.ts` (keep its `runOp` in step with the extractor's).
- HeroUI `ToggleButtonGroup selectionMode="single"` renders `role="radio"` buttons — e2e uses `getByRole("radio")`.
- `NumberField` snaps to `step` — use `step={0.01}` for money or 173.69 shows as 173.70.
- Drawer width goes on `Drawer.Dialog` (not `Drawer.Content`, which is the full-screen flex container).
- `tests/` compiles without the DOM lib: reach the app hook as `(globalThis as unknown as Vida).__vida` inside `page.evaluate`.

## Learned in 1c
- Patient-level changes (wallet, profile payer, walk-in) run through `useWorld.getState().actW((w, fx) => …)`, which
  returns fn's result — return plain values (ids, strings), never immer drafts (they are revoked after the commit).
- 1c actions: `store/wallet.ts` (addAdvance, refundAdvance, settleCredit, credit links, reprint) and `store/payer.ts`
  (setPayer, payer story, PayerDraft, createWalkinVisit). The drawer's credit / advance-refund branches are
  `DrawerState.credit` / `.advRefund` (`isSimple`: one part, no split, no notes).
- The payer story body is shared (`features/stories/PayerStory.tsx`): callers pass a `PayerRun` — return `true` from
  the change to mean "payer decided". NPHIES answers after `NPHIES_DELAY` (1.1 s); e2e just waits for it.
- Golden extractor 1c ops drive v3's own UI (set `state.adv` / `state.drawer`, `render()`, click `#aGo` / `#dGo`;
  click buttons inside `renderPayerStory(c)` / `renderCreditStory(c)`). Seed visits are all invoiced after the 1b
  flows, so payer-story ops run on the walk-in visits (ids 100+).
- HeroUI `Select` trigger's accessible name is "<value> <label>" — e2e opens it with `getByRole("button", { name: / Clinic$/ })`.
  `Switch` inputs are visually hidden: click the label text. A `Disclosure`'s content stays mounted when collapsed —
  render heavy content only when expanded.

## Learned in M2
- Commits: git has no identity configured — pass `GIT_AUTHOR_NAME/EMAIL` and `GIT_COMMITTER_NAME/EMAIL` (Roger /
  roger@test.com, as earlier commits) as env vars; never change git config.
- Work-in-progress UI state of a story lives in the UI store (`ui.refund`, `ui.replace`) and goes into `StoryUiCtx`
  (`refundInvoiceId`, `replaceCaseId`) built in `VisitScreen`; the visit's own story state (`c.addStory`) lives on the visit.
- Actions: `store/refund.ts` (openRefundOn, completeRefund, raiseRefundInvoice), `store/replace.ts` (doReplace,
  undoReplace, completeReplaceRefund, checkInsurerApproval), Add orders in `store/payer.ts` (addOrdersStory). Pure parts:
  `domain/refund.ts` (refundStart, refundCalc), `domain/replace.ts` (billedLines, replacePreview …).
- Drawer money-back branches: `advRefund`, `refund`, `refundDiff` (`isMoneyBack`); closing a `refundDiff` drawer undoes the
  replacement. Refund ids use the same seeded random as invoice ids (`newRefundId`), so golden flows stay deterministic.
- Golden extractor ops for M2 drive v3's own cards: `renderAddOrdersStory` (#aoGo), `openRefund` + `renderRefundWork`
  (#rfGo) + drawer #dGo, `invoiceReplace(c,inv).open()` + `renderReplaceWork` (#rpGo / #rpCheck). Reset `S.replace` after
  each op so v3's storyStage does not read leftover UI state. The flow snapshot now also carries refunds / replaced /
  refund invoices — keep `snap` identical in `extract.html` and `flows.test.ts`.
- `useWorld.getState().actW` is how a UI action gets a result back from a visit action (e.g. `doReplace` → refundDiff).
