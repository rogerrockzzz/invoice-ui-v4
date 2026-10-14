# VIDA OPD Billing v4 — agent notes

## Start here
- Plan for Milestone 1 (checkpoints 1a / 1b / 1c): `docs/PLAN-v4-M1.md` — read §0–§6, then your checkpoint.
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
