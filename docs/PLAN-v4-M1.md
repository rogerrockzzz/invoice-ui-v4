# VIDA OPD Billing v4 — Milestone 1 plan (HeroUI rebuild of `journey-opd-v3.html`)

This file is the single source of truth for Milestone 1. It is written so that **any session can pick up
any checkpoint cold**: read §0–§6 once, then jump to your checkpoint (§7 / §8 / §9).

---

## 0. Session protocol (read first, every session)

1. Read this file (§0–§6) and `AGENTS.md` at the project root. Invoke the **`heroui-react`** skill
   (`.devin/skills/heroui-react/`) before writing any UI code.
2. Read `docs/PARITY.md` (created in 1a) to see what is done, in progress, and what drifted in v3.
3. Find your checkpoint below. Work its tasks **in order**; each task lists the v3 source lines to port from.
4. Before touching a HeroUI component for the first time in a session, fetch its docs:
   `node .devin/skills/heroui-react/scripts/get_component_docs.mjs <Component>`. v3 API only — never v2
   (no `HeroUIProvider`, no `framer-motion`, compound components like `Card.Header`, `onPress` not `onClick`).
5. Definition of done for a checkpoint: every acceptance box ticked, `npm run verify` green
   (typecheck + lint + unit + e2e + build), PARITY.md updated, one git commit
   `M1<x>: <summary>` (use the commit format in the global rules).
6. If you stop mid-checkpoint: commit WIP on a branch `m1<x>-wip`, and append a **Handoff** note at the
   bottom of this file (date, what is done, what is next, gotchas). Delete the note when the checkpoint closes.
7. Drift: at the start of each checkpoint run the drift check (§6.3). New v3 behaviour that lands in an
   already-finished area goes into PARITY.md as a TODO, not silently into the current checkpoint.

---

## 1. Decisions (locked during the planning session — do not reopen without the user)

| Topic | Decision |
|---|---|
| Purpose | **Clickable prototype v4** — mock data, browser only, no backend |
| Stack | **Vite + React 18/19 + TypeScript (strict)**, **HeroUI v3.2.6** (`@heroui/react`, `@heroui/styles`), **Tailwind CSS v4**, `tailwind-variants` |
| State | **Zustand** (+ `immer` middleware, so v3's mutating logic ports 1:1) |
| Billing rules | **Ported exactly** into pure TS; unit tests pinned to v3 figures (golden fixtures, §6.2) |
| Look | **Pure HeroUI components + VIDA brand colours** (navy/blue/red) via theme variables. No custom CSS look-alikes of v3 |
| Theme | **Light + dark** |
| Devices | **Desktop + tablet** (test at 1440×900 and 1024×768; tablet portrait 768 must not break) |
| Language | **i18n-ready now, Arabic later** (M4). All UI strings via keys; RTL-safe CSS from day one |
| Numerals | **Western 0–9 always**, both languages: `SAR 1,234.50` |
| Icons | **lucide-react** (replace every emoji in v3) |
| Testing | **Vitest** (domain) + **Playwright** (flows) |
| Package manager | **npm**. Scripts run with system npm 9.2.0; **installs need `npx -y npm@11.21.0 install …`** (npm 9/10 crash — see AGENTS.md). Never sudo. Run `npm run deps:age` after any dependency change |
| Repo | Vite app at the **root of `Invoice UI V4`**, `git init` there; `docs/` stays as is |
| v3 source of truth | **`docs/Devin Invoice UI/journey-opd-v3.html`** (this copy). v3 keeps evolving → drift tracking (§6.3) |
| Milestone 1 scope | Home, patient profile, patient tabs, Visit invoicing, Orders invoicing, payment drawer, visit timeline, **full Simulate panel**, **full wallet** (chip, statements, Add advance / Refund advance / Settle credit), **Payer story**, **Walk-in / new visit**, **Invoices screen + invoice popup** |
| Later | M2 Add orders + Refund + Replace · M3 Package booking + Package procedure + LWBS · M4 Ask VIDA + Story map + Settings + Arabic/RTL |

**Out of M1 but must not be blocked:** Refund/Replace/Package/LWBS/Add orders/Ask VIDA. Where v3 shows an
entry point for them inside M1 screens (e.g. the "Left without being seen" button, the Refund story tab,
"Bill as cash now"), render it **disabled with a "Coming in M2/M3" tooltip** — do not hide it, so the layout
matches v3.

---

## 2. Environment

- Node v22.22.1, npm 9.2.0 at `/usr/bin/npm`, git 2.53, `google-chrome` (headless works), python3.
- **No `curl`** — use `wget` or Node `fetch`.
- Port **8765** is used by an older server serving `/home/roger/Documents/Roger_BK/Devin Invoice UI`
  (the original folder, *not* this copy). Leave it alone.
- Serve this project's v3 reference on **8766**: `python3 -m http.server 8766 --bind 127.0.0.1` from the
  project root → `http://127.0.0.1:8766/docs/Devin%20Invoice%20UI/journey-opd-v3.html`.
- Vite dev server: default **5173**. Playwright uses `vite preview` on **4173**.
- v3 smoke suite (reference only): `docs/Devin Invoice UI/_smoke_journey3.html` — see that folder's `AGENTS.md`.

---

## 3. How v3 is built (what you are porting)

`journey-opd-v3.html` is 5,931 lines: CSS (~63 KB) + one `<script>` (~320 KB, 182 functions). Everything is
global mutable state + string-template rendering; `render()` rebuilds the whole page on every change.

### 3.1 Data model (v3 lines 861–1226)
- `patients{mrn → { mrn, name, age, gender, mobile, wallet:{advance:{Open,Doctor,Clinic}}, payers[], ledger[], walletDocs[] }}`
  — wallet and payers belong to the **patient**.
- `cases[]` = visits: `{ id, mrn, visitType, clinic, doctor, arrived, date, sortKey, payerId, dedUsed,
  consult:Line, orders:Line[], invoices:Invoice[], bill:Bill|null, link, closed, prefs, history:Event[],
  interbranch?, fromBranch?, parentId?, future?, clinical?, lwbs?, storyDone?, activeStory?, … }`.
- `Line = { code, name, price, priceIns?, priceCash?, ins:'approved'|'partial'|'pending'|'rejected'|'notcovered'|'notinsured',
  paid, via?, invoiceId?, ordered?, package?, children?, byReception?, selfPay?, performed?, urgentCash?, approvalPending? }`.
- `Bill` = a prepared charge, **not** an invoice: `{ scope:'consult'|'orders', codes[], patient, company, deductible, rows[], cashOnly?, replacing? }`.
  **The invoice is created only when payment completes** (`payAll`).
- `Invoice = { id:'INV-xxxxxx', scope, at, patient, company, deductible, paid, via, payments?[], payer, rows[{name,code,calc}], settled?, voided?, replaced?, branch?, … }`.
- Ledger entry types: `ADV_IN, ADV_USED, REFUND_IN, ADV_REFUND, CREDIT_RAISED, CREDIT_SETTLED`; each creates a
  wallet document `ADV-/RADV-/CRED-######` (`WALLET_DOC`, `makeWalletDoc`).
- Constants: `VAT=0.15`, `CASH_FACTOR=0.88`, `insStatuses` (cov: approved 1, partial 0.6, others 0), `PAY_MODES`,
  `SECOND_MODE`, `NOTES`, `REFUND_MODES`, `ADV_CATS`, `CLINICS`, `BRANCHES`, `DOCTORS`, `VISIT_TYPES`,
  `ORDER_CATALOG`, `CONSULT_FEES`, `NPHIES`, `INTERNAL_PAYERS`, `PAYER_DIRECTORY`, `LATER_ORDERS`, `CLINIC_CLOSE`.

### 3.2 Seed scenarios (keep them identical — tests and demos depend on them)
| MRN | Patient | Payer(s) | Visits (id) — what they demo |
|---|---|---|---|
| 7000203 | WADHA DAIFALLAH (4M/F) | NCCI A, MEDGULF B, Cash | 1 today consult approved, unbilled · 12 past paid · 13 today follow-up (no charge, parent 12) · 21 interbranch past paid · 31 booked +6d |
| 7000667 | MOHAMMED AL QAHTANI (41/M) | BUPA GOLD, TAWUNIYA SILVER (lapsed in NPHIES), Cash · advance Open 500 · credit 300 (INV-731044 120 + INV-742118 180) | 2 today consult paid, 4 orders mixed (approved/partial/pending/package) · 10, 11 past on credit · 20 interbranch today from AL TAKHASSUSI · 30 booked +2d |
| 7100482 | NOURA AL HARBI | TAWUNIYA SILVER · advance Open 200 | 3 today consult **pending approval** |
| 8825140 | AHMED BIN SALEM | Cash only | 4 today consult + order paid, performed |
| 1063301 | RASANGIKA JAYAWARDHANA | Cash (NPHIES finds new GIG CLASS C) | no visits — walk-in demo |

Visit number shown in UI = `V` + (100000 + id) (e.g. id 2 → `V100002`).

### 3.3 Function map (v3 line numbers at the time of writing — re-check with the drift tool)
| Area | Functions (line) |
|---|---|
| Pricing | `dedPool` 1236, `calcLine` 1242, `cashPriceOf/insPriceOf` 1261, `priceLines` 1263, `onBill/billedAlready/approvedOrders/pendingOrders/due/collected` 1277–1291 |
| Refund/credit predicates | `lineRefundable` 1294, `refundable` 1299, `refundState` 1301, `refundableInvoices` 1308, `consultDone` 1314, `creditOf` 1318, `paidOf/visitCredit/advTotal` 1325–1328, `creditInvoices` 1330, `creditTotal` 1337 |
| Replace (M2, port predicates only if needed) | `billedLines` 1345 … `invoiceReplace` 1499, `packageItems` 1524 |
| Ledger/docs | `LEDGER_LABEL` 1541, `logLedger` 1546, `WALLET_DOC` 1556, `makeWalletDoc` 1565, `ledgerRows` 1585 |
| History/toast | `record` 1599, `toast` 1602 |
| Actions | `startBill` 1617, `startCashBill` 1630, `cancelBill` 1653, `sendLink` 1671, `resendLink` 1678, **`payAll` 1686**, `setPayer` 1781, `openCreditPicker` 1801, `checkDoctor` 1810, `checkOrders` 1866, `selectedLines/toggleLine` 1882–1901 |
| Stories engine | `STORIES` 1908, `storyOfEvent` 1961, `isVisitStep` 1975, `ordersOpen/visitDone` 1981, `mainStory` 1983, `visitStories` 1988, `storyBadge` 2003, `storyLock` 2019, `activeStory` 2026, `storyHasWork` 2035, `settleDone` 2043, `switchStory` 2046, **`storyStage` 2056**, `stagesBar` 2108, `markDone` 2118, `renderStoryStrip` 2122, `renderStoryCard` 2142, `renderVisitDoneCard` 2163 |
| Payer story | `startPayerStory` 2257, `finishEligibility` 2265, `tobHtml` 2280, `payerChoiceCard` 2299, `renderPayerStory` 2319, `applyPayer` 2443 |
| Credit story | `renderCreditStory` 2970 |
| **Step machine** | **`nextStep` 3025–3229** (keys below) |
| Visit relations | `parentVisit` 3234, `rootVisit` 3243, `visitNo` 3250, `visitDate` 3252, `pendingVisits` 3262, `actionTile` 3269, `pendingSummary` 3305 |
| Simulated world | `simApproveConsult` 3314, `LATER_ORDERS` 3322, `simOrders` 3329, `checkApproval` 3357, `simApproval` 3372, `simPaid/simStale` 3386 |
| Navigation | `visitsOf` 3390, `openPatient` 3391, `openVisit` 3397, `closeTab` 3407, `goHome` 3418, `render` 3421, `renderTabs` 3453 |
| Screens | `renderHome` 3476, `renderPatient` 3583, `renderVisit` 3738, `renderStep` 3795, `orderTable` 3819 |
| Walk-in | `startWalkin` 3862, `renderWalkin` 3868, `CLINIC_CLOSE/freeSlots` 3990, `backToPayerChoices` 4006, `payerDraft` 4012, `keepPayerOnPatient` 4027, `activePayerOf` 4031, `startProfilePayer/renderProfilePayer` 4040–4103, `startWalkinPayer` 4104, `createWalkinVisit` 4117 |
| Wallet | `walletChipHtml` 4159, `walletState` 4167, `renderWalletSection` 4171, `renderAdvanceDrawer` 4306 |
| Timeline | `addComment` 4359, `renderHistory` 4363, `EV_TITLES` 4464, `renderEventPop` 4472 |
| Invoices | `findInvoice` 4445, `openInvoice` 4461, `allInvoices` 4543, `INV_PRESETS/presetRange` 4551, `invDate` 4562, `INV_FILTERS/invFilters` 4574, `queryInvoices` 4586, `loadInvoices` 4604, `openInvoicesFor` 4614, `invFilterSummary` 4619, `renderInvoices` 4626, `ivDecorate` 4690, `pairInvoices` 4697, `invoiceTable` 4733, `renderPatientInvoices` 4825, `reprint` 4854, `renderLedger` 4863, `renderLedgerPop` 4900, `renderWalletDocPop` 5375, `renderInvoicePop` 5411 |
| **Payment drawer** | `payTaken` 5493, `payAllocated/payRemaining` 5494, `payTendered` 5497, `payActive` 5503, `payParts` 5511, `advShortfall` 5517, **`renderDrawer` 5525–5872** |
| Shell | `renderSettings` 5873 (M4), `renderSim` 5893 |

### 3.4 `nextStep(c)` keys (the heart of both invoicing stories)
`CONSULT_WAIT` → `CONSULT_BILL` → (`COLLECT` | `COLLECT_WAIT` | `COLLECT_ZERO`) → `SEE_DOCTOR` → `WAIT_DOCTOR`
→ `ORDERS_MIXED` | `ORDERS_BILL` | `ORDERS_WAIT` → (`COLLECT*`) → `CLOSE` → `CLOSED`.
Also `REPLACE_COLLECT` (M2), `PKG_PRINT`/`PKG_DONE` (M3), `LWBS` (M3), `NO_ORDERS` (procedure-only visits).
Each step returns `{ key, tone:'wait'|'done'|'', tag, q, sub, amt?, amtLabel?, amts?, ext?{title,lines,selectable,note,open}, yes?, no?, acts?[], back? }`.

**Porting rule:** in v4 `nextStep` returns **data only** — `actions` are `{ id, label, variant }` with an `id`
that the UI maps to a store action. No closures, no HTML in `q`/`sub`: use i18n keys + params and a tiny
rich-text convention (`<b>` → `<strong>` via `Trans` components). This keeps it testable and translatable.

---

## 4. Target architecture

```
/                         (project root = "Invoice UI V4")
├─ AGENTS.md              session notes (commands, ports, pointers to this plan)
├─ docs/                  v3 reference, PLAN-v4-M1.md, PARITY.md, v3-baseline.html
├─ tools/v3-golden/       extract.html — runs v3 headless and dumps golden JSON (§6.2)
├─ index.html
├─ src/
│  ├─ main.tsx  App.tsx  theme.css  i18n.ts
│  ├─ domain/             PURE TS. No React, no Zustand, no DOM. 100% unit-tested.
│  │  ├─ types.ts         Patient, Visit, Line, Bill, Invoice, LedgerEntry, WalletDoc, HistoryEvent, Payer, Plan, StoryId, StepKey …
│  │  ├─ constants.ts     VAT, CASH_FACTOR, INS_STATUSES, PAY_MODES, SECOND_MODE, NOTES, REFUND_MODES, ADV_CATS, CLINICS, BRANCHES, DOCTORS, VISIT_TYPES, ORDER_CATALOG, CONSULT_FEES, LEDGER_LABEL, WALLET_DOC
│  │  ├─ money.ts         fmt (Western digits always), round2 (= v3 `+x.toFixed(2)` semantics — keep identical!)
│  │  ├─ pricing.ts       dedPool, calcLine, priceLines, cashPriceOf, insPriceOf
│  │  ├─ lookup.ts        pt, payerOf, planOf, walletOf, payerName, firstName, visitsOf, walletDocsOf, walletDocVisit, visitDocs, findInvoice
│  │  ├─ lines.ts         onBill, billedAlready, approvedOrders, pendingOrders, consultDone, ordersOpen, due, collected, selectedLines,
│  │  │                   creditOf, paidOf, creditInvoices, creditTotal, lineRefundable, refundable, refundState, performedOf   (built in 1a)
│  │  ├─ replace.ts       billingType, approvalOf, isApproved, invoiceReplace, packageItems(Left) — predicates only in M1
│  │  ├─ ledger.ts        makeWalletDoc, ledgerRows, numberSeedLedger
│  │  ├─ cash.ts          NOTES, noteLabel, suggestNotes, notesTotal
│  │  ├─ drawer.ts        payTaken/payAllocated/payRemaining/payTendered/payActive/payParts/advShortfall (1b)
│  │  ├─ stories.ts       STORIES, visitStories, mainStory, visitDone, isVisitStep, payerChangeable, storyStage(uiCtx), storyBadge, storyLock, activeStory (pure), storyHasWork, storyOfEvent
│  │  ├─ steps.ts         nextStep (data only), pendingSummary, pendingVisits
│  │  ├─ visits.ts        isToday, isFuture, parentVisit, rootVisit, relationTo, visitNo, visitDate, activePayerOf (freeSlots in 1c)
│  │  ├─ payers.ts        searchPayers (NPHIES flow in 1c)
│  │  ├─ invoices.ts      allInvoices, presetRange, invDate, invType/Status/Mode/PayerType, INV_FILTERS, queryInvoices, patientInvoiceSummary
│  │  ├─ clock.ts         injectable now()/today() — tests freeze it
│  │  └─ ids.ts           injectable id generators (INV-, ADV-, CRED-, case ids) — tests make them deterministic
│  ├─ data/seed.ts        patients, cases, NPHIES, INTERNAL_PAYERS, PAYER_DIRECTORY, LATER_ORDERS — copied verbatim from v3
│  ├─ store/
│  │  ├─ world.ts         Zustand+immer: { patients, cases, settings } + domain actions (startBill, payAll, setPayer, sendLink, cancelBill, checkDoctor, checkOrders, checkApproval, simApproveConsult, simOrders, simApproval, simPaid, simStale, logLedger, record, addComment, createWalkinVisit, applyPayer, addAdvance, refundAdvance, settleCredit …)
│  │  ├─ ui.ts            Zustand: { screen, tabs, activeMrn, caseId, q, drawer, invPop, eventPop, ledgerPop, walletOpen, wallet, walkin, simOpen, theme, … }
│  │  ├─ toasts.ts        thin wrapper over HeroUI Toast
│  │  └─ reset.ts         resetWorld() → fresh seed (used by tests and the Simulate panel)
│  ├─ ui/                 shared building blocks on top of HeroUI
│  │  ├─ Money.tsx        <Money value tone="due|soft|ok"/>
│  │  ├─ StoryStepper.tsx custom stepper (HeroUI has none) — chips with done/now/next/skip/locked states
│  │  ├─ StepCard.tsx     renders a NextStep value: tag Chip, question, sub, amount(s), action Buttons, Back, ext table
│  │  ├─ OrderTable.tsx   HeroUI Table with optional checkbox selection + totals (port of orderTable)
│  │  ├─ InvoiceLink.tsx  Link that opens the invoice modal
│  │  ├─ PayerChip.tsx  WalletChip.tsx  StatusPill.tsx  EmptyState.tsx  ComingSoon.tsx
│  └─ features/
│     ├─ shell/           AppHeader (brand, branch Select, theme toggle, user), PatientTabs, Toasts host
│     ├─ home/            HomeSearch, PatientResult (expandable), WalkinEntry
│     ├─ patient/         PatientHeader, PendingActions (Today/Upcoming/Past), VisitsList, PatientInvoices
│     ├─ visit/           VisitHeader, StoryStrip, StoryCard router, VisitTimeline, EventModal
│     ├─ stories/         visit/ orders/ payer/ credit/ advadd/ advrefund/ (one component per story)
│     ├─ drawer/          PaymentDrawer (+ CashNotes, SplitParts, ModePicker, AdvanceBox, CreditBox)
│     ├─ wallet/          WalletSection, LedgerTable, WalletDocModal
│     ├─ walkin/          WalkinFlow (6 stages)
│     ├─ invoices/        InvoicesScreen, InvoiceFilters, InvoiceTable, InvoiceModal
│     └─ sim/             SimulatePanel
├─ tests/e2e/             Playwright specs (one per checkpoint area)
└─ src/**/__tests__/      Vitest specs; src/domain/__golden__/v3.json
```

**Rules**
- `domain/` imports nothing from React/Zustand. Every function keeps its **v3 name** so PARITY.md can map 1:1.
- Store actions are thin: call domain functions, mutate via immer, call `record()`/`logLedger()`/toast — the
  same side effects in the same order as v3.
- Navigation is store-driven (`ui.screen`), like v3. **No router in M1** (keeps tab state simple). Optional:
  mirror `screen/mrn/caseId` into the URL hash for reloadability — only if trivial.
- No `dangerouslySetInnerHTML`. History events store `{ type, key, params }`; seed history is converted once
  at load (strip `<b>` → structured text).
- `round2(x) = +x.toFixed(2)` — **do not** replace with `Math.round(x*100)/100`; the goldens depend on JS
  `toFixed` behaviour.

---

## 5. UI system

### 5.1 HeroUI component mapping
| v3 element | HeroUI v3 |
|---|---|
| Header: logo, VIDA wordmark, branch `<select>`, gear, user | layout `div` + `Select`, `Button` (icon), `Avatar`, `Dropdown` (theme toggle + "Settings — M4") |
| Patient tabs (`renderTabs`) | `Tabs` (secondary/underline variant) with a close `CloseButton` inside each tab; "Invoices" as a right-aligned `Button` |
| Home search | `SearchField` (debounced), results as `Card` list; expansion via `Disclosure` |
| Blank states | `Card` + `Typography` (`EmptyState`) |
| Patient header | `Card` → `Card.Header` (name/MRN/age/mobile) + `WalletChip` (`Button` + `Chip`) + `PayerChip` (`Button` → opens payer story/profile payer) |
| Pending actions Today/Upcoming/Past | `Tabs` with count `Badge`, tiles as `Card` rows with `Chip` status + primary `Button` "Open" |
| Visits list | `Table` (or `Card` list) + `TextField` visit no. + `DateRangePicker` + `Switch` "Pair related visits" |
| Story strip | row of `ToggleButton`s in a `ToggleButtonGroup` (single selection); lock → `isDisabled` + `Tooltip`; new → `Badge` dot |
| Stage bar | **custom `StoryStepper`** from `Chip`s + lucide `Check`/`Minus`; `ProgressBar` optional |
| Step card | `Card` + `Chip` tag + `Typography` + `Button` variants: primary action `variant="primary"`, yes/confirm green → `color/variant` per docs (success), secondary `variant="secondary"`, ghost `variant="ghost"`, danger `variant="danger"` |
| "What is being charged" | `Disclosure` containing `OrderTable` (`Table` + `Checkbox`) |
| Payment drawer | `Drawer` (placement end/right; full-width bottom sheet below 768px) with `ToggleButtonGroup`/`RadioGroup` for modes, `Dropdown` for "More modes", `NumberField`s, `Alert` for advance/credit boxes, footer `Button`s |
| Popups (invoice, event, ledger, wallet doc) | `Modal` |
| Toasts | `Toast` (max 3, newest first, ~4.2 s — v3 behaviour) |
| Timeline | `Card` list with lucide icons + `Chip` story label; comment box `TextArea` + `Button` |
| Wallet section | `Card` + `Tabs` (Advance / Credit) + `Table` (statement) + story area |
| Walk-in form | `Select`, `ComboBox`, `RadioGroup`, `TimeField`/slot `ToggleButtonGroup`, `Fieldset`, `Form` |
| Payer story | `Card` per NPHIES policy, `SearchField` group/contract/policy, `Table` (TOB), `TextField`s for policy details |
| Invoices filters | `ToggleButtonGroup` presets, `DateRangePicker`, `Select` ×6, primary `Button` "Load invoices", `Link` "Clear filters" |
| Simulate panel | floating `Button` bottom-start → `Popover` (or `Drawer` start) listing sim actions for the open visit |

If a mapping turns out wrong after reading the component docs, choose the closest HeroUI component and note
it in PARITY.md — do **not** hand-roll a look-alike.

### 5.2 Theme (`src/theme.css`)
```css
@import "tailwindcss";
@import "@heroui/styles";
/* VIDA overrides — light */
:root, [data-theme="light"] {
  --accent: oklch(0.5291 0.1290 248.80);          /* VIDA blue #1f6fb2 — primary actions */
  --accent-foreground: var(--snow);
  --background: oklch(0.9593 0.0069 247.90);      /* #eef2f6 */
  --foreground: oklch(0.2705 0.0252 258.34);      /* #1f2733 */
  --muted: oklch(0.5616 0.0254 254.49);           /* #6b7684 */
  --border: oklch(0.9264 0.0080 253.86);          /* #e3e7ec */
  --success: oklch(0.5591 0.1353 152.47);         /* #1c8a4b  "Yes / Confirm payment" */
  --success-foreground: var(--snow);
  --warning: oklch(0.6092 0.1316 67.49);          /* #b6710a  waiting / credit */
  --danger:  oklch(0.5855 0.2231 29.08);          /* VIDA red #e2231a — refunds, amounts due */
  --vida-navy: oklch(0.3401 0.0798 248.79);       /* #0f3a5f  brand, active tab, headings */
  --vida-red:  oklch(0.5855 0.2231 29.08);
  --vida-purple: oklch(0.4851 0.1517 297.92);     /* interbranch tag #6b46a8 */
}
[data-theme="dark"] { /* start from HeroUI dark defaults; raise accent/danger lightness until WCAG AA on --surface */ }
```
- Run `node .devin/skills/heroui-react/scripts/get_theme.mjs` first and override **only existing variable names**.
- Brand-only tokens (`--vida-*`) are exposed to Tailwind via `@theme inline { --color-vida-navy: var(--vida-navy); … }`.
- Theme switch: `<html data-theme="light|dark" class="light|dark">`, persisted to `localStorage`, default light.
- Dark: verify contrast of red amounts, amber "waiting", and the navy brand on dark surfaces (AA 4.5:1 for text).
- Typography: keep v3 density (13px base) using Tailwind `text-sm`/`text-xs`; do not shrink HeroUI controls below
  their default touch size on tablet.

### 5.3 i18n & RTL
- `i18next` + `react-i18next`; `src/locales/en.json` (namespaced by feature). `ar.json` created empty in 1a.
- `<html lang dir>` driven by the store; `dir="rtl"` must flip layout (HeroUI/React Aria handle components).
- CSS: logical utilities only — `ms-/me-/ps-/pe-/start-/end-/text-start/text-end`. **Lint rule** (eslint
  `no-restricted-syntax` or a simple grep in `npm run verify`) bans `ml-|mr-|pl-|pr-|left-|right-|text-left|text-right`.
- Directional icons (chevrons, arrows) via a `<DirIcon>` that mirrors in RTL.
- Data values (patient names, clinic names, payer labels, codes) are **not** translated.
- `fmt()` always uses `en-US` digits: `"SAR " + n.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})`.

---

## 6. Cross-cutting: tests, goldens, drift

### 6.1 Scripts (package.json)
`dev`, `build`, `preview`, `typecheck` (tsc -b), `lint` (eslint), `test` (vitest run), `test:e2e` (playwright test),
`golden` (§6.2), `verify` = typecheck && lint && test && build && test:e2e.

### 6.2 Golden fixtures from v3 (how "port exactly" is enforced)
- `tools/v3-golden/extract.html` loads `../../docs/Devin%20Invoice%20UI/journey-opd-v3.html` in an iframe
  (served from the project root on 8766), freezes nothing, and evaluates v3's own functions:
  - `priceLines(c, lines)` for every seed visit × {consult, approved orders, all orders as approved};
  - `calcLine` on a matrix: ins ∈ all statuses × plans {BUPA GOLD, NCCI A, TAWUNIYA SILVER, none} × dLeft {0, 10, 143, 1000};
  - `dedPool`, `creditTotal`, `ledgerRows(mrn,'ADV'|'CREDIT')`, `suggestNotes` for [0.05, 65.55, 273.69, 999.99, 1234.5];
  - `nextStep(c).key`, `storyStage(c,id)`, `visitStories(c)`, `pendingSummary(c).kind` for every seed visit;
  - scripted flows (call v3 actions directly): visit 1 bill→cash pay; visit 3 approve→bill→link→paid;
    visit 2 bill 3 approved → split Span+OPEN advance; credit settle for 7000667 — snapshot invoices/ledger after each.
  - Strip non-deterministic fields (`INV-` random ids, `at` times) before writing.
- Run: `timeout 90 google-chrome --headless --disable-gpu --no-sandbox --virtual-time-budget=15000 --dump-dom "http://127.0.0.1:8766/tools/v3-golden/extract.html" > /tmp/g.html`
  then `npm run golden` (a Node script) pulls the `<pre id="out">` JSON into `src/domain/__golden__/v3.json`.
- Vitest compares v4 domain output to the golden JSON. **A failing golden is a bug in v4 unless v3 changed** —
  then regenerate goldens, review the diff, and record it in PARITY.md.
- Known anchors (from v3 screens, must hold): visit 2 consultation invoice SAR 65.55 patient / SAR 262.20 BUPA;
  visit 2 deductible left **SAR 143.00**; visit 2 "Bill the 3 approved now" **SAR 273.69**; 7000667 advance
  SAR 500.00, credit SAR 300.00; visit 4 invoices SAR 287.50 and SAR 207.00.

### 6.3 Drift tracking (v3 keeps changing)
- 1a saves `docs/v3-baseline.html` (copy of v3 at start) and records its `sha256` in PARITY.md.
- `tools/v3-drift.mjs`: diffs current v3 vs baseline **by function** (extract `function name(` / `const NAME =`
  blocks) and prints added/removed/changed names with line numbers.
- At the start of every checkpoint: run it; for each changed function mark the PARITY row `DRIFT`; decide
  (with the user if unclear) whether it is in the current checkpoint. After porting, refresh the baseline +
  goldens and update the sha.

### 6.4 `docs/PARITY.md` format
| v3 item (function / story / screen) | v3 line | v4 module | Checkpoint | Status (`todo`/`wip`/`done`/`drift`/`deferred-M2..M4`) | Notes |

### 6.5 Playwright conventions
- Projects: `desktop` 1440×900 and `tablet` 1024×768 (Chromium). Light theme default; one smoke pass in dark.
- Click by **accessible name/label**, never by index (`getByRole('button', { name: 'Yes, bill it' })`).
- Each spec starts from a fresh page (or `window.__vida.reset()`). `window.__vida = { reset, world, ui }` is always exposed — decided in 1a: prototype, mock data only.
- Freeze the clock in tests (`page.clock.install({ time: … })`) so `now()` strings are stable.
- Port the intent of the relevant `_smoke_journey3.html` sections (headings quoted per checkpoint below).

---

## 7. Checkpoint 1a — Foundation (shell, home, patient, tabs, domain + goldens)

**Goal:** a themed, i18n-ready app where you can search a patient, open them in tabs and see their profile
exactly as v3 shows it — backed by a fully tested domain layer.

### Tasks
1. **Scaffold**
   - `git init`; `.gitignore` (node_modules, dist, test-results, playwright-report, .vite).
   - `npm create vite@latest . -- --template react-ts` (root already has `docs/` and `.devin/` — keep them).
   - Install (pin exact versions ≥7 days old): `@heroui/react@3.2.6 @heroui/styles@3.2.6 tailwind-variants tailwindcss @tailwindcss/vite zustand immer i18next react-i18next lucide-react`;
     dev: `vitest @vitest/coverage-v8 @playwright/test eslint typescript-eslint eslint-plugin-react-hooks prettier`.
     `npx playwright install chromium`.
   - Vite: `@tailwindcss/vite` plugin; TS `strict`, `noUncheckedIndexedAccess`.
   - `src/theme.css` per §5.2; import in `main.tsx`. No provider (HeroUI v3).
   - Root `AGENTS.md` already exists — update commands if they change.
2. **Domain layer** (`src/domain/*`, `src/data/seed.ts`) — port, keeping v3 names:
   constants, money, pricing, lines, credit, refund predicates, ledger, cash, visits, payers, invoices (query only),
   stories (`STORIES`, `visitStories`, `mainStory`, `ordersOpen`, `visitDone`, `isVisitStep`, `storyStage`,
   `storyBadge`, `storyLock`, `storyHasWork`, `storyOfEvent`), steps (`nextStep` as data, `pendingSummary`,
   `pendingVisits`), `clock.ts`, `ids.ts`. `storyStage` reads UI state in v3 (drawer/refund/replace) — pass an
   explicit `uiCtx` argument instead.
3. **Goldens**: `tools/v3-golden/extract.html` + `scripts/golden.mjs` (§6.2); generate `v3.json`; Vitest specs
   `pricing.test.ts`, `credit.test.ts`, `ledger.test.ts`, `cash.test.ts`, `stories.test.ts`, `steps.test.ts`.
4. **Store**: `world.ts` (seed loaded, `record`, `logLedger`, `addComment`), `ui.ts` (screen, tabs, activeMrn,
   caseId, q, walletOpen, theme, lang), `openPatient`, `openVisit` (sets screen 'visit' — the visit screen itself
   is 1b; render a placeholder "Visit screen — checkpoint 1b"), `closeTab`, `goHome`, `resetWorld`.
5. **Shell**: `AppHeader` (red "+" mark, "DR SULAIMAN AL HABIB / Medical Group", **VIDA®** wordmark in `--vida-red`,
   branch `Select` from `BRANCHES` → toast "Hospital changed", theme toggle, user "SAADAN SAAFAN · Reception · OPD"),
   `PatientTabs` (Home + one tab per open patient with pending-count badge + close; "Invoices" button right — routes
   to a placeholder until 1c), `Toasts` host. Content max-width ≈ 960px desktop (v3), fluid on tablet.
6. **Home** (`renderHome` 3476): search by name / MRN / mobile (spaces ignored) / doctor (with or without "Dr");
   blank state "Search for a patient to begin…" (+ "You have N patient(s) open"); results expandable showing that
   patient's pending work (compact `actionTile`) and two entry cards (open profile / new walk-in — walk-in disabled
   "Coming in 1c"); patients matched via doctor are labelled. "Story map" link disabled ("M4").
7. **Patient profile** (`renderPatient` 3583): breadcrumb; header (name, MRN·age/gender·mobile, visits on file,
   `WalletChip` with Advance/Credit — opening the wallet = placeholder until 1c); active payer row (`activePayerOf`,
   "N payers on file", payer button with deductible %·cap·discount — "Change" disabled until 1c);
   **Pending actions** card with Today / Upcoming / Past tabs + counts and `actionTile` rows (time, visit type ·
   clinic, interbranch tag, Dr · payer, status pill To do/Waiting/Ongoing/Upcoming, "Next: <stage>", Open);
   **Visits** list (filters: visit no., from/to dates, "Pair related visits" switch using `parentVisit/rootVisit`;
   rows with status chip Upcoming/Action needed/Closed + one-line summary from `nextStep`); **Invoices** summary
   collapsed ("7 on file incl. 3 advance/credit · SAR … collected · SAR … on credit") — table body in 1c.
8. **i18n**: all strings above via `t()`; `en.json`; empty `ar.json`; `lang`/`dir` wiring; logical-CSS lint guard.
9. **E2E** `tests/e2e/1a-shell.spec.ts`: smoke headings to mirror —
   "choosing the patient offers two cards, and loads nothing else", "upcoming", "past", "booked visits come first,
   flagged upcoming, then today's", "back to the patient", "and back to the homepage",
   "switching tabs moves between patients without losing the others", "and one can be closed".
10. **Docs**: create `docs/PARITY.md` (all rows from §3.3, statuses set), `docs/v3-baseline.html` + sha, `tools/v3-drift.mjs`.

### Acceptance (1a)
- [x] `npm run verify` green; Vitest covers every `domain/` file; all goldens match.
- [x] Searching "qahtani", "7000667", "0555112233", "subaie" and "dr subaie" each find MOHAMMED AL QAHTANI.
- [x] 7000667 profile shows Advance SAR 500.00, Credit SAR 300.00, BUPA · GOLD "deductible 20% · cap SAR 200.00 · 5% discount", Today 2 / Upcoming 1 / Past 0, 5 visits in v3 order and statuses.
- [x] Three patients open as tabs, switch and close without losing the others' state.
- [x] Light/dark toggle works and persists; no layout break at 1024×768 and 768×1024.
- [x] `grep` guard finds no physical-direction utilities; no hard-coded UI strings outside `en.json` (spot-check).
- [x] PARITY.md, baseline + sha, drift tool committed. Commit `M1a: foundation`.

---

## 8. Checkpoint 1b — Core billing flow (visit + orders invoicing, drawer, timeline, Simulate)

**Goal:** every M1 visit can be taken end-to-end — approval → bill → collect (desk or link) → doctor →
orders → bill → collect → complete — with the same amounts, events and toasts as v3.

### Tasks
1. **Drift check** (§6.3).
2. **Visit screen** (`renderVisit` 3738): breadcrumb Home / patient / "Consultation · CARDIOLOGY · Today";
   header (patient line + "N other visit(s)", **Deductible left**, `WalletChip`); visit row (clinic · Dr · visit
   type · date/time · `V10000x`, interbranch tag); payer chip **locked (lock icon) once anything is invoiced**,
   otherwise opens the Payer story (story itself in 1c — until then disabled with tooltip).
3. **Story strip** (`renderStoryStrip` 2122) for `visitStories(c)`: icon, title, badge (`storyBadge`), lock reason
   tooltip (`storyLock`), "done ✓", **new** dot rule exactly as v3 (line 2129). M2+ stories (refund, replace,
   package, addorders) appear per `visitStories` but open a `ComingSoon` card. Story switching = `switchStory`
   (incl. `visitPinned`, `seen`, `settleDone`).
4. **`StoryStepper`** from `storyStage` (done ✓ / now / next / skip – / locked) — port `stagesBar` classes.
5. **`StepCard`** rendering any `nextStep` value; actions map `id → store action`:
   `billConsult`, `billApproved`, `waitAll`, `releaseHeld`, `checkApproval`, `checkConsultApproval`
   (`simApproveConsult`), `openDrawer`, `sendLink`, `resendLink`, `markLinkPaid`, `cancelBill` (Back),
   `checkDoctor`, `checkOrders`, `recordZero` (`payAll(c,'No charge')`), `reopen`. `billCashUrgent` (startCashBill),
   `lwbs` → disabled "M3"/"M2" with tooltip. `renderVisitDoneCard` ("Go to Orders invoicing").
6. **`OrderTable`** (`orderTable` 3819): rows with ins status chip, gross/discount/deductible/patient/company,
   running deductible pool (`dedPool(c).left` consumed only by non-pending ticked lines), package children,
   selectable checkboxes via `toggleLine` (≥1 must stay ticked → warn toast), totals, interbranch branch label,
   `note` line. Inside a `Disclosure` titled by `ext.title`.
7. **Actions in store** (exact v3 side-effects, history entries, toasts): `startBill`, `startCashBill` (disabled UI,
   but port it — M2 Replace depends on it), `cancelBill`, `sendLink` (always user-triggered; v3's
   `settings.autoSend` is only a Settings toggle with no caller — port the flag, wire nothing, M4), `resendLink`, **`payAll`** (invoice creation, `payments[]`,
   deductible consumption, per-pot advance draw + `ADV_USED`, `CREDIT_RAISED` for credit part, PKGREADY event when a
   paid package has children), `checkDoctor` (2nd check succeeds), `checkOrders` → `simOrders`, `checkApproval`
   (2nd check succeeds) → `simApproval`, `selectedLines/toggleLine` (re-prices a prepared bill).
8. **Payment drawer** (`renderDrawer` 5525, payment branch only; refund/refundDiff/advRefund branches are for 1c
   advrefund + M2): header "Payment · <name>" + amount (tinted success / warning when Credit);
   **modes**: `top` modes + advance pots that hold money on the face, the rest behind "More modes" (count);
   advance mode with empty pot → warn toast; **Cash**: amount to pay / cash handed over / change or still to
   allocate, notes grid `NOTES` with +/− and "The usual notes for SAR x" (`suggestNotes`) / Clear, manual tender
   hint; **non-cash**: part amount + "would still be unpaid" hint; **"＋ Add this SAR x and pay the rest another
   way"** → pushes a part, preselects `secondMode`; taken parts list (click = edit back, ✕ = remove); card refs
   (approval no., last 4), referral refs, finance voucher; **advance box** (drawn per pot, wallet after, or "Not
   enough advance" → confirm disabled); **credit box** ("Left unsettled", credit after); total row label
   ("To collect" / "To put on credit" / "To collect and put on credit" + parts breakdown); confirm button label
   rules (line 5690); Cancel/✕/scrim close. Confirm builds `detail` (tendered, notes, change, parts) and calls `payAll`.
   Tablet: drawer becomes a bottom sheet below 768px; all controls ≥ 40px touch.
9. **Visit timeline** (`renderHistory` 4363): newest first; comment box ("Leave a comment for yourself or the next
   person on this visit…") → `addComment`; each row: icon by `ic`, title + sub (invoice ids as `InvoiceLink`s),
   story chip (`storyOfEvent`), time; click → `EventModal` (`renderEventPop` 4472: lines with ins status, amounts,
   per-invoice "View"). Invoice modal itself is 1c — until then `InvoiceLink` opens a minimal read-only `Modal`
   (id, payer, rows, totals).
10. **Simulate panel** (`renderSim` 5893): floating "Simulate" button bottom-start → panel titled
    "World events · <first name>" acting on the open visit (falls back to `cases[0]` when no visit is open — keep
    that, but show which visit it targets). Exactly v3's buttons, lucide icons instead of emoji:
    "Consultation approval arrives" → `simApproveConsult`; "Doctor places 3 orders" → `simOrders`;
    "Remaining approvals arrive" → `simApproval`; "Patient pays the open link" → `simPaid`;
    "Link goes unpaid for 14 minutes" → `simStale`; "Reset" → `resetWorld()` (v3 reloads the page — v4 resets the
    store, same effect); "Hide". Always visible (it is a prototype).
11. **Toasts**: port every toast text in the actions above (kind ok/warn/info, title, sub).
12. **E2E** `tests/e2e/1b-billing.spec.ts` (desktop + tablet) mirroring smoke headings:
    "the charge is prepared, but nothing is invoiced yet", "two buttons only — the modes live in the pop-up",
    "the desk is the commonest, so it leads", "the rarer production modes sit behind \"more\", not on the face",
    "and the link button just sends the link", "exactly one new history entry, and it names the invoice created",
    "both choices are offered", "and the orders can be expanded", "rebuild a mixed visit: two approved, one pending",
    "the card separates what is known from what is still a guess", "while waiting, there is a way back to billing the
    approved ones", "go back on hold, then let the approval land so everything bills together",
    "switching mode inside the pop-up swaps its fields", "completing it inside the pop-up creates the invoice and
    clears the link", "first the patient is sent to the doctor — nothing moves until the doctor starts",
    "first check finds nothing, second brings the orders in", "the consultation was billed at the other branch, so it
    is not asked for here", "bill the approved one — the invoice records where the work was done",
    "the flow must move on, not ask for the consultation again", "the same holds for orders put on credit".

### Acceptance (1b)
- [ ] Visit 2 (7000667): Orders invoicing at stage 3 "Bill orders", question "4 procedures were ordered. 3 have approval, 1 does not.", **SAR 273.69**; "Bill the 3 approved now" → "How is MOHAMMED paying for the orders — SAR 273.69?" → desk: split **Span 100 + OPEN advance rest** → invoice created, advance reduced by the OPEN part, `ADV_USED` ledger entry, one PAYMENT history row naming the invoice, toast "Payment received · SAR 273.69".
- [ ] Visit 3 (7100482): "Approval not received…" → check → approval → bill → send link → Simulate "patient paid" → invoice via Payment link → SEE_DOCTOR → check twice → WAIT_DOCTOR → check twice → orders arrive.
- [ ] Visit 1 cash desk payment with notes: tender SAR 100 for SAR 46.00-type amount shows correct change; detail string records notes.
- [ ] Credit mode: putting part on credit raises `CREDIT_RAISED`, wallet chip credit rises by that amount.
- [ ] Visit 20 interbranch: no consultation step; invoice carries `branch`.
- [ ] All `nextStep`/`storyStage` results for scripted flows equal the goldens.
- [ ] `npm run verify` green on desktop + tablet. PARITY updated. Commit `M1b: core billing flow`.

---

## 9. Checkpoint 1c — Wallet, Payer story, Walk-in, Invoices

**Goal:** the patient-level money (advance/credit), choosing/confirming the payer, creating a visit at the desk,
and finding/viewing any invoice — all v3-faithful.

### Tasks
1. **Drift check** (§6.3).
2. **Wallet section** (`renderWalletSection` 4171) opened from `WalletChip` on profile **and** visit (same
   component, inline below the header like v3): header totals + Close; `Tabs` Advance / Credit with balances;
   statement via `ledgerRows(mrn, kind)` (each account replayed independently, running balance ending at the real
   figure, inflow/outflow, wallet doc id → `WalletDocModal` (`renderWalletDocPop` 5375), invoice links work);
   switching tabs while a flow is open → warn "Finish this first". `renderLedgerPop` 4900 for the full statement.
3. **Add advance story** (`advadd`: Pot & amount → Payment → Added): pot `ToggleButtonGroup` (Open/Doctor/Clinic),
   amount `NumberField`, then the **payment drawer** in "advance" mode (`renderAdvanceDrawer` 4306 — read it; advance
   modes and Credit excluded), on confirm: pot += amount, `ADV_IN` ledger + ADV- doc, history on the visit if opened
   from one, toast. Done card.
4. **Refund advance story** (`advrefund`: Pot & amount → Reason → Refund mode → Refunded): amount ≤ pot, reason
   required, drawer **money-back branch** (`REFUND_MODES` minus "Advance wallet"), on confirm (renderDrawer
   `d.advRefund` branch from line 5821): pot −= amount, `ADV_REFUND` + RADV- doc, history, toast.
5. **Credit settlement story** (`renderCreditStory` 2970, `openCreditPicker` 1801; stages Choose invoices → Payment
   → Settled): all credit invoices across visits pre-ticked, per-row amount (`creditOf`) + view link, total; drawer
   in `credit` mode (Credit mode excluded); on confirm: invoices `settled`, `CREDIT_SETTLED` + CRED- doc, history
   **on the visit it was settled from**, wallet credit drops; story appears on any visit while credit exists.
6. **Payer story** (`renderPayerStory` 2319; stages Eligibility check → Choose payer → Policy details → Payer set)
   opened from the visit header payer chip **only while nothing is invoiced** (`payerChangeable` 2256 =
   no live invoices && no bill && not a package visit; otherwise warn toast "Payer is fixed — Something has been
   invoiced — use Replace instead."): NPHIES check
   (`startPayerStory`/`finishEligibility` — simulated latency + result list incl. "Not eligible · Policy expired on
   30 Sep" and **new** policy found (1063301 GIG)); choice cards (`payerChoiceCard`) for eligible policies + Cash +
   search of `PAYER_DIRECTORY` by group/contract/policy (nothing listed until searched); TOB table opens in place
   (`tobHtml`); policy details form (cash skips it — stage shown as skipped); internal charity payer requires a
   reference and self-approves; `applyPayer`/`setPayer` (approval reset rules, `appr` memory per payer, dedUsed
   reset, PAYER event, warn toast). Profile-level payer change (`startProfilePayer/renderProfilePayer`,
   `keepPayerOnPatient`, `activePayerOf`) from the profile payer button.
7. **Walk-in / new visit** (`renderWalkin` 3868; stages Patient → Visit details → Orders (optional) → Payer →
   Review → Visit created): entry from the home patient card and the profile; clinic/doctor/visit type, free slots
   (`freeSlots`, `CLINIC_CLOSE`), optional reception orders from `ORDER_CATALOG` (trending no-doctor chips + search;
   needs-doctor items disabled — port `renderOrderPicker` 2176 read-only enough for selection), payer stage runs the
   same eligibility as the payer story (`startWalkinPayer`), review, `createWalkinVisit` (new id from `ids.ts`,
   consult fee from `CONSULT_FEES`, approval requested/auto per payer, VISIT + APPROVAL events) → opens the new visit.
   A patient with an open visit can still get another.
8. **Invoices screen** (`renderInvoices` 4626): search box (invoice no., patient name, MRN); "What should be loaded?"
   card — nothing loads until "Load invoices"; date presets Today/Yesterday/Last 7 days/This month/Any date + from/to;
   filters Clinic, Doctor, Payer type, Invoice type, Status, Payment mode (`INV_FILTERS`); results `invoiceTable`
   (`ivDecorate`, `pairInvoices` for replaced/refund pairs, status chips, branch, wallet docs included), filter
   summary, Clear filters; `openInvoicesFor(mrn)` from the patient Invoices card ("link through to the full invoices
   screen, filtered to this patient").
9. **Patient invoices card** (`renderPatientInvoices` 4825): collapsed by default with headline figures; expanded
   table; actions work from there.
10. **Invoice modal** (`renderInvoicePop` 5411): printable layout (header, payer, rows with
    gross/discount/deductible/patient/company/VAT, totals, payments list with refs, credit/settled state, branch,
    package children); "Reprint" (`reprint`) → `window.print()` with a print stylesheet. Replace the 1b minimal modal.
11. **E2E** `tests/e2e/1c-wallet-payer-walkin-invoices.spec.ts` mirroring smoke headings:
    "a patient with no visit today can still be given one", "a patient who already has an open visit can be given
    another", "the payer stage runs the same eligibility check as the visit", "and the patient profile now lists both",
    "no button on the step — the payer chip in the header is the way in", "the payer is a story: NPHIES eligibility
    first", "nothing outside the eligibility result is loaded until searched for", "the table of benefits opens in
    place", "cash needs no policy details", "an internal charity payer: a reference is required, and it approves on its
    own", "top the wallet up and it shows the draw per category", "the visit header keeps only the deductible left
    beside the wallet", "neither table carries the other account's movements", "each has a single running balance of
    its own, ending at the real figure", "invoice links still work from the credit statement", "add advance through the
    wallet story", "now spend it on a charge, and check the invoice number comes through", "give this patient fresh
    credit to settle", "the entry is on this visit, not on whichever other visit raised the credit",
    "collapsed by default, but the headline figures are still there", "and a link through to the full invoices screen,
    filtered to this patient".

### Acceptance (1c)
- [ ] 7000667: Advance statement ends at SAR 500.00, Credit statement ends at SAR 300.00, no cross-account rows.
- [ ] Add advance 250 to Doctor pot → chip SAR 750.00; drawer on a new charge shows DOCTOR mode with "SAR 250.00 available".
- [ ] Refund advance 100 from Open by Cash → `ADV_REFUND`, RADV- doc, chip updates.
- [ ] Settle both credit invoices (SAR 300.00) by Span from visit 2 → credit SAR 0.00, CREDIT_SETTLED entry on visit 2's timeline, invoices show Settled.
- [ ] Payer story on 7000667 visit 30 shows TAWUNIYA "Not eligible · Policy expired on 30 Sep"; 1063301 shows new GIG CLASS C.
- [ ] Walk-in for 1063301 → Cardiology, slot, GIG payer → visit created and opened at CONSULT_WAIT/CONSULT_BILL per v3.
- [ ] Invoices screen loads nothing until "Load invoices"; "Any date" lists every seed invoice incl. wallet docs; search "INV-771204" finds it; modal prints.
- [ ] All goldens still match; `npm run verify` green desktop + tablet + one dark pass. PARITY updated.
- [ ] Commit `M1c: wallet, payer, walk-in, invoices`. **Milestone 1 review with the user.**

---

## 10. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Drawer complexity (split, notes, advance shortfall, credit, money-back) | Domain `drawer.ts` fully unit-tested first; UI second; split into sub-components |
| `storyStage`/`nextStep` depend on UI state in v3 | explicit `uiCtx` param; goldens cover the combinations |
| Float rounding drift | `round2 = +x.toFixed(2)` everywhere v3 uses it; goldens |
| HeroUI component gaps (stepper, closable tabs) | build minimal custom pieces from HeroUI primitives (`Chip`, `Tabs`, `CloseButton`), never raw look-alikes |
| v3 changes mid-milestone | drift tool + PARITY `drift` status + golden regeneration at each checkpoint |
| Tablet ergonomics | Playwright tablet project from 1a; drawer → bottom sheet < 768px |
| Dark-mode contrast of VIDA red/amber | tune in `[data-theme=dark]`, check AA in 1a |
| npm 9 quirks | `npx npm@10` fallback; lockfile committed |

---

## Handoff notes
_(append here when stopping mid-checkpoint; delete when the checkpoint closes)_
