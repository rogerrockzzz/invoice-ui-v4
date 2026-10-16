# v3 → v4 parity

Tracks every top-level declaration of the v3 prototype against its v4 home. Updated at the end of each
checkpoint and whenever `npm run drift` reports a change (docs/PLAN-v4-M1.md §6.3–6.4).

## Baseline
- v3 source of truth: `docs/Devin Invoice UI/journey-opd-v3.html`
- Baseline copy: `docs/v3-baseline.html`
- Baseline sha256: `3a85893d44b83dcd604d7a6cd75f6314ebbac417e8038ed67347d26fa480385e` (taken 2026-10-13, checkpoint 1a)
- Goldens: `src/domain/__golden__/v3.json` — regenerate with `npm run golden`

## Status summary
deferred-M3: 7, deferred-M4: 29, done: 266 (of 302 declarations) — Milestone 3 in progress (3a done)

## Screens and stories
| v3 screen / story | Checkpoint | Status | Notes |
|---|---|---|---|
| Header (brand, branch, settings, user) | 1a | done | settings menu holds the theme switch; branch settings dialog is M4 |
| Patient tabs | 1a | done | |
| Home search + patient cards | 1a | done | walk-in card opens the walk-in (1c) |
| Patient profile: header, payer row, pending actions, visits, package items, invoices | 1a, 1c | done | wallet section, profile payer and invoices table added in 1c |
| Visit screen, story strip, stepper, step card, order table | 1b | done | payer chip opens the Payer story (1c); M3 stories shown with a "Coming in …" card |
| Visit invoicing / Orders invoicing | 1b | done | scripted flows golden-tested step by step against v3 |
| Payment drawer | 1b, 1c, 2b, 2c | done | payment, credit-settlement, advance-refund, refund and replacement-refund branches |
| Visit timeline + event pop-up | 1b | done | "Go to invoices" works from 1c |
| Simulate panel | 1b | done | |
| Wallet section + Add advance / Refund advance / Credit settlement | 1c | done | golden flows + e2e |
| Payer story, profile payer | 1c | done | golden flows + e2e |
| Walk-in visit | 1c | done | golden flows (4 walk-ins) + e2e |
| Invoices screen + invoice pop-up | 1c | done | wallet document pop-up, reprint + print stylesheet |
| Add orders | 2a | done | golden flow + e2e; NO_ORDERS "Add orders" opens it |
| Refund | 2b | done | lands on the visit's Refund story from the invoice table / invoice pop-up / event pop-up; refund invoice pop-up |
| Replace | 2c | done | insured (cash-billed order → policy) and cash-patient (one invoice at a time) flows; refund of the difference; walk-away undoes it |
| LWBS | 3a | done | pop-up from SEE_DOCTOR, LWBS step with undo; golden flow + e2e |
| Package booking, Package procedure | M3 | deferred-M3 | |
| Ask VIDA, Story map, Settings, Arabic/RTL | M4 | deferred-M4 | i18n keys and RTL-safe CSS from 1a |

## Deviations from v3 (deliberate)
- Texts are i18n keys (`src/locales/en.json`) with v3's exact English; golden tests compare them word for word.
- `nextStep` returns data (action ids, not closures); `storyStage` takes the UI context explicitly; `activeStory` is pure.
- v3 history keeps light markup (`<b>`) — v4 renders `<b>` / `<inv>` itself (`ui/Rich.tsx`), never as HTML.
- Disabled entry points for later work are shown where v3 has them, with a "Coming in …" tooltip (`ui/ComingSoon.tsx`).
- Patient tabs are Buttons + CloseButton rather than HeroUI Tabs (a close control may not sit inside `role="tab"`).
- v3's actions live in `store/actions.ts` as functions on a plain World (run inside an immer draft via `useWorld.act`);
  their toasts are collected and fired after the change commits. History and ledger texts are resolved through i18n when
  recorded (v3 stores the finished English too).
- `payTendered` resets the notes while rendering in v3; v4 does the same reset after every drawer change
  (`normalizeDrawer`), which reaches the same state.
- Story strip and drawer modes are `ToggleButtonGroup`s, so their buttons expose `role="radio"`; a locked story stays
  clickable so it can say why ("Not just now"), as in v3.
- The Simulate panel is a fixed `Card`, not a `Popover`, so the page stays usable while it is open (as in v3).
- `openCreditPicker` moved to 1c with the Credit story.
- Golden scripted flows: `tools/v3-golden/extract.html` writes the op list and v3's snapshot after each op; seeded
  `Math.random` (invoice numbers) and masked times keep it deterministic. 1c ops drive v3's own drawers and story cards
  (`state.adv` / `state.drawer` + their confirm buttons, `renderPayerStory` / `renderCreditStory` buttons).
- 1c: the payer story's state lives on the visit (world store) or, for the walk-in and the profile, on a `PayerDraft`
  in the UI store; one `PayerStoryBody` renders all three. NPHIES still answers after 1.1 s.
- 1c: the wallet section's state (`ui.wallet`) is per patient as in v3; patient-level changes run through
  `useWorld.actW` (no visit needed — a patient with no visits can still top up).
- 1c: the Invoices screen keeps the ids it loaded and reads them from the live world (v3 keeps the row objects —
  same membership, statuses stay current). Wallet documents are not on it, exactly as v3's `allInvoices` (the plan's
  "incl. wallet docs" refers to the profile's invoice table, which lists them).
- 1c: v3 settles credit by an advance pot without drawing the pot (only the old `"Advance"` mode draws) — ported as is.
- M2: v3's `state.refund` / `state.replace` are `ui.refund` / `ui.replace`; they feed `StoryUiCtx` and are dropped when
  the visit is left (`dropInline`, v3 `dropInlineRefund`). Refunds always land on the visit first (`openRefund`); Replace is
  only opened from its story, so v3's Replace pop-up variant is rendered as the story card only.
- M2: `doReplace` returns `{ refundDiff }` and the UI opens the refund slide-in (v3 sets `state.drawer` inside the action).
- M2: refund invoices (`RFD-`) carry `paid: false` (unset in v3) so they never count as money collected.
- M2: v3 quirks ported as they are (golden-tested): `undoReplace` of an insured visit's partial replacement puts the visit on
  `CASH` (it assumes the move was cash → insurance); the history of a cash visit's consultation replacement reads
  "moving 1 order(s)"; the overpayment refund after a replacement is listed under `refunds` but does not raise
  `refundedTotal`.
- 1c: a settled credit invoice's pop-up says "Settled — mode" (v3 shows "Paid in full — Credit").
- 1c: Reprint also calls `window.print()` with a print stylesheet that prints only the open document (plan §9.10).
- 1c: amounts are typed in HeroUI `NumberField`s; v3's Refund advance pot picker greys out empty pots (disabled toggles).

## Declarations
| v3 name | v3 line | v4 module | Checkpoint | Status | Notes |
|---|---|---|---|---|---|
| `BUILD` | 861 | — | 1a | done | label only (golden metadata) |
| `VAT` | 862 | domain/constants.ts | 1a | done |  |
| `fmt` | 863 | domain/money.ts | 1a | done |  |
| `now` | 864 | domain/clock.ts | 1a | done | injectable clock |
| `el` | 865 | — | — | done | DOM helper, replaced by React |
| `insStatuses` | 867 | domain/constants.ts | 1a | done |  |
| `DESK_MODES` | 875 | domain/constants.ts | 1a | done |  |
| `PAY_MODES` | 878 | domain/constants.ts | 1a | done |  |
| `payMode` | 892 | domain/constants.ts | 1a | done |  |
| `modeLabel` | 893 | domain/constants.ts | 1a | done |  |
| `SECOND_MODE` | 896 | domain/constants.ts | 1a | done |  |
| `secondMode` | 898 | domain/constants.ts | 1a | done |  |
| `NOTES` | 900 | domain/cash.ts | 1a | done |  |
| `noteLabel` | 901 | domain/cash.ts | 1a | done |  |
| `suggestNotes` | 903 | domain/cash.ts | 1a | done |  |
| `notesTotal` | 913 | domain/cash.ts | 1a | done |  |
| `REFUND_MODES` | 915 | domain/constants.ts | 1a | done |  |
| `ADV_CATS` | 916 | domain/constants.ts | 1a | done |  |
| `CASH_PAYER` | 917 | domain/constants.ts | 1a | done |  |
| `CLINICS` | 918 | domain/constants.ts | 1a | done |  |
| `BRANCHES` | 919 | domain/constants.ts | 1a | done |  |
| `DOCTORS` | 920 | domain/constants.ts | 1a | done |  |
| `VISIT_TYPES` | 921 | domain/constants.ts | 1a | done |  |
| `ORDER_CATALOG` | 924 | domain/constants.ts | 1a | done |  |
| `trendingOrders` | 941 | domain/constants.ts | 1a | done |  |
| `procOnly` | 942 | domain/lines.ts | 1a | done |  |
| `CONSULT_FEES` | 943 | domain/constants.ts | 1a | done |  |
| `patients` | 946 | data/seed.ts | 1a | done | nextCaseId → domain/ids.ts |
| `NPHIES` | 981 | data/seed.ts | 1a | done | nextCaseId → domain/ids.ts |
| `INTERNAL_PAYERS` | 1008 | data/seed.ts | 1a | done | nextCaseId → domain/ids.ts |
| `PAYER_DIRECTORY` | 1019 | data/seed.ts | 1a | done | nextCaseId → domain/ids.ts |
| `searchPayers` | 1032 | domain/payers.ts | 1a | done |  |
| `cases` | 1039 | data/seed.ts | 1a | done | nextCaseId → domain/ids.ts |
| `daysAhead` | 1203 | data/seed.ts | 1a | done | nextCaseId → domain/ids.ts |
| `BOOKED_1` | 1205 | data/seed.ts | 1a | done | nextCaseId → domain/ids.ts |
| `nextCaseId` | 1220 | data/seed.ts | 1a | done | nextCaseId → domain/ids.ts |
| `state` | 1222 | store/ui.ts, store/world.ts | 1a | done | only the fields used so far |
| `settings` | 1226 | store/ui.ts, store/world.ts | 1a | done | only the fields used so far |
| `pt` | 1229 | domain/lookup.ts | 1a | done |  |
| `payerOf` | 1230 | domain/lookup.ts | 1a | done |  |
| `planOf` | 1231 | domain/lookup.ts | 1a | done |  |
| `walletOf` | 1232 | domain/lookup.ts | 1a | done |  |
| `payerName` | 1233 | domain/lookup.ts | 1a | done |  |
| `dedPool` | 1236 | domain/pricing.ts | 1a | done |  |
| `calcLine` | 1242 | domain/pricing.ts | 1a | done |  |
| `isPending` | 1258 | domain/pricing.ts | 1a | done |  |
| `CASH_FACTOR` | 1260 | domain/constants.ts | 1a | done |  |
| `cashPriceOf` | 1261 | domain/pricing.ts | 1a | done |  |
| `insPriceOf` | 1262 | domain/pricing.ts | 1a | done |  |
| `priceLines` | 1263 | domain/pricing.ts | 1a | done |  |
| `onBill` | 1277 | domain/lines.ts | 1a | done |  |
| `billedAlready` | 1279 | domain/lines.ts | 1a | done |  |
| `inPlay` | 1281 | domain/lines.ts | 1a | done |  |
| `approvedOrders` | 1282 | domain/lines.ts | 1a | done |  |
| `pendingOrders` | 1283 | domain/lines.ts | 1a | done |  |
| `doctorOrders` | 1284 | domain/lines.ts | 1a | done |  |
| `due` | 1287 | domain/lines.ts | 1a | done |  |
| `refundedOf` | 1288 | domain/lines.ts | 1a | done |  |
| `collected` | 1290 | domain/lines.ts | 1a | done |  |
| `lineRefundable` | 1294 | domain/lines.ts | 1a | done |  |
| `refundable` | 1299 | domain/lines.ts | 1a | done |  |
| `refundState` | 1301 | domain/lines.ts | 1a | done |  |
| `refundableInvoices` | 1308 | domain/lines.ts | 1a | done |  |
| `consultDone` | 1314 | domain/lines.ts | 1a | done |  |
| `creditOf` | 1318 | domain/lines.ts | 1a | done |  |
| `onCreditInv` | 1324 | domain/lines.ts | 1a | done |  |
| `paidOf` | 1325 | domain/lines.ts | 1a | done |  |
| `visitCredit` | 1326 | domain/lines.ts | 1a | done |  |
| `visitCreditTot` | 1327 | domain/lines.ts | 1a | done |  |
| `advTotal` | 1328 | domain/lookup.ts | 1a | done |  |
| `creditInvoices` | 1330 | domain/lines.ts | 1a | done |  |
| `creditTotal` | 1337 | domain/lines.ts | 1a | done |  |
| `liveInvoices` | 1344 | domain/lines.ts | 1a | done |  |
| `billedLines` | 1345 | domain/replace.ts | 2c | done | golden flows + e2e |
| `billingType` | 1349 | domain/replace.ts | 1a | done |  |
| `replaceLinesFor` | 1350 | domain/replace.ts | 2c | done | golden flows + e2e |
| `replacePreview` | 1356 | domain/replace.ts | 2c | done | golden flows + e2e |
| `undoReplace` | 1385 | store/replace.ts | 2c | done | golden flows + e2e |
| `doReplace` | 1410 | store/replace.ts | 2c | done | golden flows + e2e |
| `approvalOf` | 1464 | domain/replace.ts | 1a | done | predicates; the Replace story uses them from 2c |
| `isApproved` | 1473 | domain/replace.ts | 1a | done | predicates; the Replace story uses them from 2c |
| `checkInsurerApproval` | 1475 | store/replace.ts | 2c | done | golden flows + e2e |
| `invoiceReplace` | 1499 | domain/replace.ts | 1a | done | predicates; the Replace story uses them from 2c |
| `packageItems` | 1524 | domain/replace.ts | 1a | done | predicates; the Replace story uses them from 2c |
| `packageItemsLeft` | 1536 | domain/replace.ts | 1a | done | predicates; the Replace story uses them from 2c |
| `LEDGER_LABEL` | 1541 | domain/constants.ts | 1a | done |  |
| `ledSeq` | 1545 | domain/ids.ts | 1a | done |  |
| `logLedger` | 1546 | store/world.ts | 1a | done | logLedgerOn / recordOn |
| `WALLET_DOC` | 1556 | domain/constants.ts | 1a | done |  |
| `walletDocSeq` | 1564 | domain/ids.ts | 1a | done |  |
| `makeWalletDoc` | 1565 | domain/ledger.ts | 1a | done |  |
| `walletDocsOf` | 1576 | domain/lookup.ts | 1a | done |  |
| `walletDocVisit` | 1578 | domain/lookup.ts | 1a | done |  |
| `ADV_TYPES` | 1582 | domain/constants.ts | 1a | done |  |
| `CREDIT_TYPES` | 1583 | domain/constants.ts | 1a | done |  |
| `ledgerRows` | 1585 | domain/ledger.ts | 1a | done |  |
| `USER` | 1598 | domain/constants.ts | 1a | done |  |
| `record` | 1599 | store/world.ts | 1a | done | logLedgerOn / recordOn |
| `toast` | 1602 | store/toasts.ts | 1a | done | HeroUI Toast; max 3, 4.2 s |
| `startBill` | 1617 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `cashHeld` | 1629 | domain/lines.ts | 1a | done |  |
| `startCashBill` | 1630 | store/actions.ts | 1b | done | "Bill the N pending order(s) as cash now" enabled in 2c |
| `cancelBill` | 1653 | store/actions.ts | 1b, 2c | done | a replacement in hand is undone (undoReplace) |
| `billLabel` | 1669 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `sendLink` | 1671 | store/actions.ts | 1b | done | always user-triggered; settings.autoSend has no caller (M4) |
| `resendLink` | 1678 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `payAll` | 1686 | store/actions.ts | 1b, 2c | done | golden flows, including the replacement branch |
| `setPayer` | 1781 | store/payer.ts | 1c | done | golden flows (payer story on the walk-in visits) |
| `openCreditPicker` | 1801 | store/wallet.ts | 1c | done | golden flows |
| `checkDoctor` | 1810 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `markLwbs` | 1827 | store/actions.ts | 3a | done | golden flow + e2e |
| `undoLwbs` | 1835 | store/actions.ts | 3a | done | golden flow + e2e |
| `renderLwbsPop` | 1841 | features/visit/LwbsModal.tsx (ui.lwbsPop) | 3a | done | golden flow drives v3's #lwGo; e2e |
| `checkOrders` | 1866 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `selectedLines` | 1882 | domain/lines.ts | 1a | done |  |
| `toggleLine` | 1886 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `STORIES` | 1908 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `EVENT_STORY` | 1957 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `ORDER_TYPES` | 1960 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `storyOfEvent` | 1961 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `VISIT_KEYS` | 1974 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `isVisitStep` | 1975 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `ordersOpen` | 1981 | domain/lines.ts | 1a | done |  |
| `visitDone` | 1982 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `mainStory` | 1983 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `visitStories` | 1988 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `storyBadge` | 2003 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `storyLock` | 2019 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `activeStory` | 2026 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `storyHasWork` | 2035 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `settleDone` | 2043 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `switchStory` | 2046 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `storyStage` | 2056 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `stagesBar` | 2108 | ui/StoryStepper.tsx | 1b | done |  |
| `withStages` | 2114 | ui/StoryStepper.tsx | 1b | done |  |
| `markDone` | 2118 | store/actions.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `renderStoryStrip` | 2122 | features/visit/StoryStrip.tsx | 1b | done | ToggleButtonGroup (single) — its buttons are role=radio |
| `renderStoryCard` | 2142 | features/visit/StoryCard.tsx | 1b | done | later stories show a 'Coming in …' card with their stages |
| `renderVisitDoneCard` | 2163 | features/visit/StoryCard.tsx | 1b | done | later stories show a 'Coming in …' card with their stages |
| `catPrice` | 2175 | domain/payers.ts | 1c | done | used by the walk-in's order picker |
| `renderOrderPicker` | 2176 | features/walkin/OrderPicker.tsx | 1c | done | reused by the Add orders story (2a) |
| `cartItems` | 2205 | domain/payers.ts | 1c | done | used by the walk-in's order picker |
| `addReceptionOrders` | 2206 | store/payer.ts | 1c | done | walk-in (1c) and the Add orders story (2a) |
| `renderAddOrdersStory` | 2218 | features/stories/AddOrdersStory.tsx, store/payer.ts | 2a | done | cart on `c.addStory`; golden flow + e2e |
| `payerChangeable` | 2256 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `startPayerStory` | 2257 | store/payer.ts, features/stories/PayerStory.tsx | 1c | done | NPHIES answers after 1.1 s (beginPayerStory) |
| `finishEligibility` | 2265 | store/payer.ts | 1c | done | works on a visit or a PayerDraft |
| `nphiesPlan` | 2278 | domain/payers.ts | 1c | done |  |
| `tobHtml` | 2280 | domain/payers.ts (tobRows), features/stories/PayerStory.tsx | 1c | done | cells are i18n messages |
| `payerChoiceCard` | 2299 | features/stories/PayerStory.tsx | 1c | done | choices are domain/payers.ts payerOptions/choosePayer |
| `renderPayerStory` | 2319 | features/stories/PayerStory.tsx | 1c | done | one body for visit, walk-in and profile (PayerRun) |
| `applyPayer` | 2443 | store/payer.ts | 1c | done | golden flows |
| `CHAT_SUGGEST_VISIT` | 2467 | features/chat | M4 | deferred-M4 |  |
| `CHAT_SUGGEST_PATIENT` | 2469 | features/chat | M4 | deferred-M4 |  |
| `CHAT_SUGGEST_HOME` | 2471 | features/chat | M4 | deferred-M4 |  |
| `chatState` | 2472 | features/chat | M4 | deferred-M4 |  |
| `chatContext` | 2474 | features/chat | M4 | deferred-M4 |  |
| `vlink` | 2489 | features/chat | M4 | deferred-M4 | Ask VIDA link helper |
| `plink` | 2490 | features/chat | M4 | deferred-M4 | Ask VIDA link helper |
| `ilink` | 2491 | features/chat | M4 | deferred-M4 | Ask VIDA link helper |
| `first` | 2492 | domain/lookup.ts (firstName) | 1a | done |  |
| `liveInv` | 2493 | features/chat | M4 | deferred-M4 | Ask VIDA helper |
| `chatNeed` | 2494 | features/chat | M4 | deferred-M4 |  |
| `chatDeductible` | 2501 | features/chat | M4 | deferred-M4 |  |
| `chatApproval` | 2518 | features/chat | M4 | deferred-M4 |  |
| `chatLastOrdered` | 2546 | features/chat | M4 | deferred-M4 |  |
| `chatShare` | 2566 | features/chat | M4 | deferred-M4 |  |
| `chatExplain` | 2575 | features/chat | M4 | deferred-M4 |  |
| `chatRange` | 2589 | features/chat | M4 | deferred-M4 |  |
| `chatCredit` | 2620 | features/chat | M4 | deferred-M4 |  |
| `chatAdvance` | 2627 | features/chat | M4 | deferred-M4 |  |
| `chatPending` | 2634 | features/chat | M4 | deferred-M4 |  |
| `chatRefunds` | 2641 | features/chat | M4 | deferred-M4 |  |
| `chatPayer` | 2648 | features/chat | M4 | deferred-M4 |  |
| `chatInvoice` | 2655 | features/chat | M4 | deferred-M4 |  |
| `chatNavigate` | 2663 | features/chat | M4 | deferred-M4 |  |
| `CHAT_HELP` | 2700 | features/chat | M4 | deferred-M4 |  |
| `chatAnswer` | 2709 | features/chat | M4 | deferred-M4 |  |
| `chatAsk` | 2730 | features/chat | M4 | deferred-M4 |  |
| `renderChat` | 2738 | features/chat | M4 | deferred-M4 |  |
| `renderStoryMap` | 2771 | features/storymap | M4 | deferred-M4 | entry point shown disabled |
| `renderDoneCard` | 2796 | features/visit/StoryCard.tsx | 1b | done |  |
| `renderRefundStory` | 2825 | features/stories/RefundStory.tsx | 2b | done | golden flow + e2e |
| `renderReplaceStory` | 2871 | features/stories/ReplaceStory.tsx | 2c | done | golden flows + e2e |
| `renderPackageStory` | 2907 | features/stories/package | M3 | deferred-M3 |  |
| `renderCreditStory` | 2970 | features/stories/CreditStory.tsx | 1c | done | link + desk; golden flows |
| `nextStep` | 3025 | domain/steps.ts | 1a | done | returns data + i18n keys; texts golden-tested word for word |
| `isToday` | 3231 | domain/visits.ts | 1a | done |  |
| `parentVisit` | 3234 | domain/visits.ts | 1a | done |  |
| `rootVisit` | 3243 | domain/visits.ts | 1a | done |  |
| `relationTo` | 3248 | domain/visits.ts | 1a | done |  |
| `visitNo` | 3250 | domain/visits.ts | 1a | done |  |
| `MONTHS` | 3251 | domain/constants.ts | 1a | done |  |
| `visitDate` | 3252 | domain/visits.ts | 1a | done |  |
| `isFuture` | 3260 | domain/visits.ts | 1a | done |  |
| `pendingVisits` | 3262 | domain/steps.ts | 1a | done | returns data + i18n keys; texts golden-tested word for word |
| `actionTile` | 3269 | ui/ActionTile.tsx | 1a | done |  |
| `pendingSummary` | 3305 | domain/steps.ts | 1a | done | returns data + i18n keys; texts golden-tested word for word |
| `simApproveConsult` | 3314 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `LATER_ORDERS` | 3322 | data/seed.ts | 1a | done | nextCaseId → domain/ids.ts |
| `simOrders` | 3329 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `checkApproval` | 3357 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `simApproval` | 3372 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `simPaid` | 3386 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `simStale` | 3387 | store/actions.ts | 1b | done | golden flows (src/store/__tests__/flows.test.ts) |
| `visitsOf` | 3390 | domain/lookup.ts | 1a | done |  |
| `openPatient` | 3391 | store/ui.ts | 1a | done | openVisit resets the visit's active story in 1b |
| `openVisit` | 3397 | store/ui.ts | 1a | done | resets the visit's active story (store/actions.ts openedVisit) |
| `closeTab` | 3407 | store/ui.ts | 1a | done | openVisit resets the visit's active story in 1b |
| `dropInlineRefund` | 3417 | store/ui.ts (dropInline) | 2b | done | golden flow + e2e |
| `goHome` | 3418 | store/ui.ts | 1a | done | openVisit resets the visit's active story in 1b |
| `render` | 3421 | App.tsx | 1a | done |  |
| `renderTabs` | 3453 | features/shell/PatientTabs.tsx | 1a | done | Buttons + CloseButton (a close control may not sit inside role=tab) |
| `renderHome` | 3476 | features/home/Home.tsx | 1a | done | walk-in card disabled until 1c |
| `renderPatient` | 3583 | features/patient/* | 1a | done | wallet section + payer change disabled until 1c |
| `renderVisit` | 3738 | features/visit/VisitScreen.tsx | 1b | done | payer change opens in 1c (shown disabled); wallet section 1c |
| `renderStep` | 3795 | ui/StepCard.tsx | 1b | done | action ids → store/stepActions.ts |
| `orderTable` | 3819 | ui/OrderTable.tsx | 1b | done | Table selection (checkbox per line); columns as v3 |
| `startWalkin` | 3862 | features/walkin/WalkinFlow.tsx | 1c | done |  |
| `renderWalkin` | 3868 | features/walkin/WalkinFlow.tsx | 1c | done | stage 1 (patient search) is unreachable in v3 (the walk-in always starts from a chosen patient) — not built |
| `CLINIC_CLOSE` | 3990 | domain/visits.ts | 1c | done |  |
| `hhmm` | 3991 | domain/visits.ts | 1c | done |  |
| `freeSlots` | 3992 | domain/visits.ts | 1c | done | unit-tested |
| `backToPayerChoices` | 4006 | store/payer.ts (backToChoices) | 1c | done |  |
| `payerDraft` | 4012 | store/payer.ts | 1c | done | the draft lives in the UI store (walkin / profPayer) |
| `keepPayerOnPatient` | 4027 | store/payer.ts | 1c | done |  |
| `activePayerOf` | 4031 | domain/visits.ts | 1a | done |  |
| `startProfilePayer` | 4040 | features/patient/ProfilePayer.tsx | 1c | done |  |
| `renderProfilePayer` | 4052 | features/patient/ProfilePayer.tsx | 1c | done | saveProfilePayer in store/payer.ts |
| `startWalkinPayer` | 4104 | features/walkin/WalkinFlow.tsx | 1c | done |  |
| `createWalkinVisit` | 4117 | store/payer.ts | 1c | done | golden flows (4 walk-ins) |
| `walletChipHtml` | 4159 | ui/WalletChip.tsx | 1a | done | opens the wallet section (1c) |
| `walletState` | 4167 | store/ui.ts (walletOn / walletDo) | 1c | done |  |
| `renderWalletSection` | 4171 | features/wallet/WalletSection.tsx | 1c | done | opened from the wallet chip on profile and visit |
| `renderAdvanceDrawer` | 4306 | features/wallet/AdvanceDrawer.tsx | 1c | done | addAdvance in store/wallet.ts; golden flows |
| `escHtml` | 4357 | — | 1a | done | not needed: React escapes text; comments stored as plain text |
| `addComment` | 4359 | store/world.ts | 1a | done | comment box + toast in features/visit/VisitTimeline.tsx |
| `renderHistory` | 4363 | features/visit/VisitTimeline.tsx | 1b | done |  |
| `findInvoice` | 4445 | domain/lookup.ts | 1a | done |  |
| `raiseRefundInvoice` | 4452 | store/refund.ts | 2b | done | golden flow + e2e |
| `visitDocs` | 4460 | domain/lookup.ts | 1a | done |  |
| `openInvoice` | 4461 | ui/InvoiceLink.tsx (ui.invPop) | 1c | done |  |
| `EV_TITLES` | 4464 | features/visit/VisitTimeline.tsx | 1b | done |  |
| `renderEventPop` | 4472 | features/visit/EventModal.tsx | 1b | done | Refund works from 2b; Go to invoices from 1c |
| `allInvoices` | 4543 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `INV_PRESETS` | 4551 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `isoDay` | 4552 | domain/visits.ts | 1a | done |  |
| `presetRange` | 4553 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `invDate` | 4562 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `invPayerType` | 4567 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `invType` | 4569 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `invStatus` | 4570 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `invMode` | 4571 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `INV_FILTERS` | 4574 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `invFilters` | 4582 | store/ui.ts (invF) | 1c | done |  |
| `invCanLoad` | 4585 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `queryInvoices` | 4586 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `loadInvoices` | 4604 | store/ui.ts | 1c | done | keeps the ids loaded and reads them from the live world |
| `openInvoicesFor` | 4614 | store/ui.ts | 1c | done |  |
| `invFilterSummary` | 4619 | domain/invoices.ts | 1c | done | unit-tested |
| `renderInvoices` | 4626 | features/invoices/InvoicesScreen.tsx | 1c | done |  |
| `ivDecorate` | 4690 | features/invoices/InvoiceTable.tsx | 1c | done |  |
| `pairInvoices` | 4697 | domain/invoices.ts | 1c | done | unit-tested |
| `invoiceTable` | 4733 | features/invoices/InvoiceTable.tsx | 1c | done | Refund action works from 2b |
| `renderPackageItems` | 4789 | features/patient/PatientCards.tsx | 1a | done | book/open actions in M3 |
| `renderPatientInvoices` | 4825 | features/patient/PatientCards.tsx | 1c | done | table only rendered once expanded |
| `reprint` | 4854 | store/wallet.ts, features/invoices/InvoiceModal.tsx | 1c | done | also opens the browser print (print stylesheet in theme.css) |
| `renderLedger` | 4863 | features/wallet/LedgerTable.tsx | 1c | done |  |
| `renderLedgerPop` | 4900 | — | 1c | done | nothing in v3 opens it (state.ledgerPop is never set) — the statement lives in the wallet section |
| `printPackageOrders` | 4932 | features/stories/package | M3 | deferred-M3 |  |
| `renderVoidPop` | 4953 | features/stories/package | M3 | deferred-M3 |  |
| `voidPrint` | 4989 | features/stories/package | M3 | deferred-M3 |  |
| `replaceInline` | 5005 | features/visit/StoryCard.tsx | 2c | done | golden flows + e2e |
| `renderReplaceWork` | 5006 | features/stories/ReplaceStory.tsx (ReplaceWork) | 2c | done | golden flows + e2e |
| `renderReplacePop` | 5018 | features/stories/ReplaceStory.tsx (ReplaceWork) | 2c | done | worked in the story card only — every entry point is inside the visit, so v3's pop-up variant is not needed |
| `openPkgBook` | 5099 | features/stories/package | M3 | deferred-M3 |  |
| `renderPkgBookPop` | 5108 | features/stories/package | M3 | deferred-M3 |  |
| `createPkgVisit` | 5163 | features/stories/package | M3 | deferred-M3 |  |
| `openRefund` | 5192 | store/ui.ts, store/refund.ts (openRefundOn), domain/refund.ts (refundStart) | 2b | done | golden flow + e2e |
| `refundCalc` | 5205 | domain/refund.ts | 2b | done | golden flow + e2e |
| `refundInline` | 5216 | features/visit/StoryCard.tsx | 2b | done | golden flow + e2e |
| `refundAmtHtml` | 5219 | features/stories/RefundStory.tsx | 2b | done | golden flow + e2e |
| `refundReasonHtml` | 5226 | features/stories/RefundStory.tsx | 2b | done | golden flow + e2e |
| `performedOf` | 5234 | domain/lines.ts | 1a | done |  |
| `refundListHtml` | 5240 | features/stories/RefundStory.tsx | 2b | done | golden flow + e2e |
| `wireRefundLines` | 5262 | features/stories/RefundStory.tsx | 2b | done | golden flow + e2e |
| `renderRefundWork` | 5277 | features/stories/RefundStory.tsx | 2b | done | golden flow + e2e |
| `completeRefund` | 5302 | store/refund.ts | 2b | done | golden flow + e2e |
| `renderRefundInvoicePop` | 5331 | features/invoices/InvoiceModal.tsx (RefundInvoiceBody) | 2b | done | golden flow + e2e |
| `renderWalletDocPop` | 5375 | features/invoices/InvoiceModal.tsx | 1c | done |  |
| `renderInvoicePop` | 5411 | features/invoices/InvoiceModal.tsx | 1c | done | settled credit invoices say "Settled — mode"; Refund works from 2b; refund invoices open their own document |
| `payTaken` | 5493 | domain/drawer.ts | 1b | done | unit-tested (drawer.test.ts) |
| `payAllocated` | 5494 | domain/drawer.ts | 1b | done | unit-tested (drawer.test.ts) |
| `payRemaining` | 5495 | domain/drawer.ts | 1b | done | unit-tested (drawer.test.ts) |
| `payTendered` | 5497 | domain/drawer.ts | 1b | done | unit-tested (drawer.test.ts) |
| `payActive` | 5503 | domain/drawer.ts | 1b | done | unit-tested (drawer.test.ts) |
| `payParts` | 5511 | domain/drawer.ts | 1b | done | unit-tested (drawer.test.ts) |
| `partsLabel` | 5515 | domain/drawer.ts | 1b | done | unit-tested (drawer.test.ts) |
| `advShortfall` | 5517 | domain/drawer.ts | 1b | done | unit-tested (drawer.test.ts) |
| `renderDrawer` | 5525 | features/drawer/PaymentDrawer.tsx, domain/drawer.ts | 1c, 2b, 2c | done | payment, credit, advance-refund, refund and refundDiff branches |
| `renderSettings` | 5873 | features/settings | M4 | deferred-M4 |  |
| `renderSim` | 5893 | features/sim/SimulatePanel.tsx | 1b | done | fixed Card, not a Popover, so the page stays usable; Reset resets both stores |
