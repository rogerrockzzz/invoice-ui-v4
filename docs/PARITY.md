# v3 → v4 parity

Tracks every top-level declaration of the v3 prototype against its v4 home. Updated at the end of each
checkpoint and whenever `npm run drift` reports a change (docs/PLAN-v4-M1.md §6.3–6.4).

## Baseline
- v3 source of truth: `docs/Devin Invoice UI/journey-opd-v3.html`
- Baseline copy: `docs/v3-baseline.html`
- Baseline sha256: `3a85893d44b83dcd604d7a6cd75f6314ebbac417e8038ed67347d26fa480385e` (taken 2026-10-13, checkpoint 1a)
- Goldens: `src/domain/__golden__/v3.json` — regenerate with `npm run golden`

## Status summary
deferred-M2: 28, deferred-M3: 10, deferred-M4: 29, done: 155, todo: 79, wip: 1 (of 302 declarations)

## Screens and stories
| v3 screen / story | Checkpoint | Status | Notes |
|---|---|---|---|
| Header (brand, branch, settings, user) | 1a | done | settings menu holds the theme switch; branch settings dialog is M4 |
| Patient tabs | 1a | done | |
| Home search + patient cards | 1a | done | walk-in card disabled until 1c |
| Patient profile: header, payer row, pending actions, visits, package items, invoices headline | 1a | done | wallet section, payer change and invoices table in 1c |
| Visit screen, story strip, stepper, step card, order table | 1b | todo | placeholder screen in 1a |
| Visit invoicing / Orders invoicing | 1b | todo | |
| Payment drawer | 1b | todo | |
| Visit timeline + event pop-up | 1b | todo | |
| Simulate panel | 1b | todo | |
| Wallet section + Add advance / Refund advance / Credit settlement | 1c | todo | |
| Payer story, profile payer | 1c | todo | |
| Walk-in visit | 1c | todo | |
| Invoices screen + invoice pop-up | 1c | todo | placeholder screen in 1a |
| Add orders, Refund, Replace | M2 | deferred-M2 | |
| Package booking, Package procedure, LWBS | M3 | deferred-M3 | |
| Ask VIDA, Story map, Settings, Arabic/RTL | M4 | deferred-M4 | i18n keys and RTL-safe CSS from 1a |

## Deviations from v3 (deliberate)
- Texts are i18n keys (`src/locales/en.json`) with v3's exact English; golden tests compare them word for word.
- `nextStep` returns data (action ids, not closures); `storyStage` takes the UI context explicitly; `activeStory` is pure.
- v3 history keeps light markup (`<b>`) — v4 renders `<b>` / `<inv>` itself (`ui/Rich.tsx`), never as HTML.
- Disabled entry points for later work are shown where v3 has them, with a "Coming in …" tooltip (`ui/ComingSoon.tsx`).
- Patient tabs are Buttons + CloseButton rather than HeroUI Tabs (a close control may not sit inside `role="tab"`).

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
| `billedLines` | 1345 | domain/replace.ts | M2 | deferred-M2 |  |
| `billingType` | 1349 | domain/replace.ts | 1a | done | predicates only; Replace/Package stories are M2/M3 |
| `replaceLinesFor` | 1350 | domain/replace.ts | M2 | deferred-M2 |  |
| `replacePreview` | 1356 | domain/replace.ts | M2 | deferred-M2 |  |
| `undoReplace` | 1385 | domain/replace.ts | M2 | deferred-M2 |  |
| `doReplace` | 1410 | domain/replace.ts | M2 | deferred-M2 |  |
| `approvalOf` | 1464 | domain/replace.ts | 1a | done | predicates only; Replace/Package stories are M2/M3 |
| `isApproved` | 1473 | domain/replace.ts | 1a | done | predicates only; Replace/Package stories are M2/M3 |
| `checkInsurerApproval` | 1475 | domain/replace.ts | M2 | deferred-M2 |  |
| `invoiceReplace` | 1499 | domain/replace.ts | 1a | done | predicates only; Replace/Package stories are M2/M3 |
| `packageItems` | 1524 | domain/replace.ts | 1a | done | predicates only; Replace/Package stories are M2/M3 |
| `packageItemsLeft` | 1536 | domain/replace.ts | 1a | done | predicates only; Replace/Package stories are M2/M3 |
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
| `startBill` | 1617 | store (actions) | 1b | todo |  |
| `cashHeld` | 1629 | domain/lines.ts | 1a | done |  |
| `startCashBill` | 1630 | store (actions) | 1b | todo |  |
| `cancelBill` | 1653 | store (actions) | 1b | todo |  |
| `billLabel` | 1669 | store (actions) | 1b | todo |  |
| `sendLink` | 1671 | store (actions) | 1b | todo |  |
| `resendLink` | 1678 | store (actions) | 1b | todo |  |
| `payAll` | 1686 | store (actions) | 1b | todo |  |
| `setPayer` | 1781 | store (actions) | 1c | todo |  |
| `openCreditPicker` | 1801 | store (actions) | 1b | todo |  |
| `checkDoctor` | 1810 | store (actions) | 1b | todo |  |
| `markLwbs` | 1827 | — | M3 | deferred-M3 | entry point shown disabled |
| `undoLwbs` | 1835 | — | M3 | deferred-M3 | entry point shown disabled |
| `renderLwbsPop` | 1841 | — | M3 | deferred-M3 | entry point shown disabled |
| `checkOrders` | 1866 | store (actions) | 1b | todo |  |
| `selectedLines` | 1882 | domain/lines.ts | 1a | done |  |
| `toggleLine` | 1886 | store (actions) | 1b | todo |  |
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
| `settleDone` | 2043 | store (actions) | 1b | todo |  |
| `switchStory` | 2046 | store (actions) | 1b | todo |  |
| `storyStage` | 2056 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `stagesBar` | 2108 | ui/StoryStepper.tsx | 1b | todo |  |
| `withStages` | 2114 | ui/StoryStepper.tsx | 1b | todo |  |
| `markDone` | 2118 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `renderStoryStrip` | 2122 | features/visit | 1b | todo |  |
| `renderStoryCard` | 2142 | features/visit | 1b | todo |  |
| `renderVisitDoneCard` | 2163 | features/visit | 1b | todo |  |
| `catPrice` | 2175 | features/stories/addorders | M2 | deferred-M2 | order picker reused by walk-in in 1c |
| `renderOrderPicker` | 2176 | features/stories/addorders | M2 | deferred-M2 | order picker reused by walk-in in 1c |
| `cartItems` | 2205 | features/stories/addorders | M2 | deferred-M2 | order picker; walk-in uses it in 1c |
| `addReceptionOrders` | 2206 | features/stories/addorders | M2 | deferred-M2 | order picker reused by walk-in in 1c |
| `renderAddOrdersStory` | 2218 | features/stories/addorders | M2 | deferred-M2 | order picker reused by walk-in in 1c |
| `payerChangeable` | 2256 | domain/stories.ts | 1a | done | storyStage takes an explicit uiCtx; activeStory does not mutate |
| `startPayerStory` | 2257 | features/stories/payer | 1c | todo |  |
| `finishEligibility` | 2265 | features/stories/payer | 1c | todo |  |
| `nphiesPlan` | 2278 | features/stories/payer | 1c | todo |  |
| `tobHtml` | 2280 | features/stories/payer | 1c | todo |  |
| `payerChoiceCard` | 2299 | features/stories/payer | 1c | todo |  |
| `renderPayerStory` | 2319 | features/stories/payer | 1c | todo |  |
| `applyPayer` | 2443 | features/stories/payer | 1c | todo |  |
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
| `renderDoneCard` | 2796 | ui/DoneCard.tsx | 1b | todo |  |
| `renderRefundStory` | 2825 | features/stories/refund | M2 | deferred-M2 |  |
| `renderReplaceStory` | 2871 | features/stories/replace | M2 | deferred-M2 |  |
| `renderPackageStory` | 2907 | features/stories/package | M3 | deferred-M3 |  |
| `renderCreditStory` | 2970 | features/stories/credit | 1c | todo |  |
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
| `simApproveConsult` | 3314 | store (actions) | 1b | todo |  |
| `LATER_ORDERS` | 3322 | data/seed.ts | 1a | done | nextCaseId → domain/ids.ts |
| `simOrders` | 3329 | store (actions) | 1b | todo |  |
| `checkApproval` | 3357 | store (actions) | 1b | todo |  |
| `simApproval` | 3372 | store (actions) | 1b | todo |  |
| `simPaid` | 3386 | store (actions) | 1b | todo |  |
| `simStale` | 3387 | store (actions) | 1b | todo |  |
| `visitsOf` | 3390 | domain/lookup.ts | 1a | done |  |
| `openPatient` | 3391 | store/ui.ts | 1a | done | openVisit resets the visit's active story in 1b |
| `openVisit` | 3397 | store/ui.ts | 1a | done | openVisit resets the visit's active story in 1b |
| `closeTab` | 3407 | store/ui.ts | 1a | done | openVisit resets the visit's active story in 1b |
| `dropInlineRefund` | 3417 | features/stories/refund | M2 | deferred-M2 |  |
| `goHome` | 3418 | store/ui.ts | 1a | done | openVisit resets the visit's active story in 1b |
| `render` | 3421 | App.tsx | 1a | done |  |
| `renderTabs` | 3453 | features/shell/PatientTabs.tsx | 1a | done | Buttons + CloseButton (a close control may not sit inside role=tab) |
| `renderHome` | 3476 | features/home/Home.tsx | 1a | done | walk-in card disabled until 1c |
| `renderPatient` | 3583 | features/patient/* | 1a | done | wallet section + payer change disabled until 1c |
| `renderVisit` | 3738 | features/visit | 1b | todo |  |
| `renderStep` | 3795 | features/visit | 1b | todo |  |
| `orderTable` | 3819 | features/visit | 1b | todo |  |
| `startWalkin` | 3862 | features/walkin, features/stories/payer | 1c | todo |  |
| `renderWalkin` | 3868 | features/walkin, features/stories/payer | 1c | todo |  |
| `CLINIC_CLOSE` | 3990 | features/walkin, features/stories/payer | 1c | todo |  |
| `hhmm` | 3991 | features/walkin | 1c | todo | slot labels |
| `freeSlots` | 3992 | features/walkin, features/stories/payer | 1c | todo |  |
| `backToPayerChoices` | 4006 | features/walkin, features/stories/payer | 1c | todo |  |
| `payerDraft` | 4012 | features/walkin, features/stories/payer | 1c | todo |  |
| `keepPayerOnPatient` | 4027 | features/walkin, features/stories/payer | 1c | todo |  |
| `activePayerOf` | 4031 | domain/visits.ts | 1a | done |  |
| `startProfilePayer` | 4040 | features/walkin, features/stories/payer | 1c | todo |  |
| `renderProfilePayer` | 4052 | features/walkin, features/stories/payer | 1c | todo |  |
| `startWalkinPayer` | 4104 | features/walkin, features/stories/payer | 1c | todo |  |
| `createWalkinVisit` | 4117 | features/walkin, features/stories/payer | 1c | todo |  |
| `walletChipHtml` | 4159 | ui/WalletChip.tsx | 1a | done |  |
| `walletState` | 4167 | features/wallet | 1c | todo |  |
| `renderWalletSection` | 4171 | features/wallet | 1c | todo |  |
| `renderAdvanceDrawer` | 4306 | features/wallet | 1c | todo |  |
| `escHtml` | 4357 | — | 1a | done | not needed: React escapes text; comments stored as plain text |
| `addComment` | 4359 | store/world.ts | 1a | done | comment box UI in 1b |
| `renderHistory` | 4363 | features/visit/VisitTimeline | 1b | todo |  |
| `findInvoice` | 4445 | domain/lookup.ts | 1a | done |  |
| `raiseRefundInvoice` | 4452 | features/stories/refund | M2 | deferred-M2 |  |
| `visitDocs` | 4460 | domain/lookup.ts | 1a | done |  |
| `openInvoice` | 4461 | features/invoices, features/wallet | 1c | todo |  |
| `EV_TITLES` | 4464 | features/visit/VisitTimeline | 1b | todo |  |
| `renderEventPop` | 4472 | features/visit/VisitTimeline | 1b | todo |  |
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
| `invFilters` | 4582 | features/invoices | 1c | todo |  |
| `invCanLoad` | 4585 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `queryInvoices` | 4586 | domain/invoices.ts | 1a | done | golden-tested; screen in 1c |
| `loadInvoices` | 4604 | features/invoices | 1c | todo |  |
| `openInvoicesFor` | 4614 | features/invoices | 1c | todo |  |
| `invFilterSummary` | 4619 | features/invoices | 1c | todo |  |
| `renderInvoices` | 4626 | features/invoices | 1c | todo |  |
| `ivDecorate` | 4690 | features/invoices | 1c | todo |  |
| `pairInvoices` | 4697 | features/invoices | 1c | todo |  |
| `invoiceTable` | 4733 | features/invoices | 1c | todo |  |
| `renderPackageItems` | 4789 | features/patient/PatientCards.tsx | 1a | done | book/open actions in M3 |
| `renderPatientInvoices` | 4825 | features/patient/PatientCards.tsx | 1a | wip | headline done; table + actions in 1c |
| `reprint` | 4854 | features/invoices, features/wallet | 1c | todo |  |
| `renderLedger` | 4863 | features/invoices, features/wallet | 1c | todo |  |
| `renderLedgerPop` | 4900 | features/invoices, features/wallet | 1c | todo |  |
| `printPackageOrders` | 4932 | features/stories/package | M3 | deferred-M3 |  |
| `renderVoidPop` | 4953 | features/stories/package | M3 | deferred-M3 |  |
| `voidPrint` | 4989 | features/stories/package | M3 | deferred-M3 |  |
| `replaceInline` | 5005 | features/stories/replace | M2 | deferred-M2 |  |
| `renderReplaceWork` | 5006 | features/stories/replace | M2 | deferred-M2 |  |
| `renderReplacePop` | 5018 | features/stories/replace | M2 | deferred-M2 |  |
| `openPkgBook` | 5099 | features/stories/package | M3 | deferred-M3 |  |
| `renderPkgBookPop` | 5108 | features/stories/package | M3 | deferred-M3 |  |
| `createPkgVisit` | 5163 | features/stories/package | M3 | deferred-M3 |  |
| `openRefund` | 5192 | features/stories/refund | M2 | deferred-M2 |  |
| `refundCalc` | 5205 | features/stories/refund | M2 | deferred-M2 |  |
| `refundInline` | 5216 | features/stories/refund | M2 | deferred-M2 |  |
| `refundAmtHtml` | 5219 | features/stories/refund | M2 | deferred-M2 |  |
| `refundReasonHtml` | 5226 | features/stories/refund | M2 | deferred-M2 |  |
| `performedOf` | 5234 | domain/lines.ts | 1a | done |  |
| `refundListHtml` | 5240 | features/stories/refund | M2 | deferred-M2 |  |
| `wireRefundLines` | 5262 | features/stories/refund | M2 | deferred-M2 |  |
| `renderRefundWork` | 5277 | features/stories/refund | M2 | deferred-M2 |  |
| `completeRefund` | 5302 | features/stories/refund | M2 | deferred-M2 |  |
| `renderRefundInvoicePop` | 5331 | features/stories/refund | M2 | deferred-M2 |  |
| `renderWalletDocPop` | 5375 | features/invoices, features/wallet | 1c | todo |  |
| `renderInvoicePop` | 5411 | features/invoices, features/wallet | 1c | todo |  |
| `payTaken` | 5493 | domain/drawer.ts, features/drawer | 1b | todo | money-back branches: advrefund in 1c, refund/refundDiff in M2 |
| `payAllocated` | 5494 | domain/drawer.ts, features/drawer | 1b | todo | money-back branches: advrefund in 1c, refund/refundDiff in M2 |
| `payRemaining` | 5495 | domain/drawer.ts, features/drawer | 1b | todo | money-back branches: advrefund in 1c, refund/refundDiff in M2 |
| `payTendered` | 5497 | domain/drawer.ts, features/drawer | 1b | todo | money-back branches: advrefund in 1c, refund/refundDiff in M2 |
| `payActive` | 5503 | domain/drawer.ts, features/drawer | 1b | todo | money-back branches: advrefund in 1c, refund/refundDiff in M2 |
| `payParts` | 5511 | domain/drawer.ts, features/drawer | 1b | todo | money-back branches: advrefund in 1c, refund/refundDiff in M2 |
| `partsLabel` | 5515 | domain/drawer.ts, features/drawer | 1b | todo | money-back branches: advrefund in 1c, refund/refundDiff in M2 |
| `advShortfall` | 5517 | domain/drawer.ts, features/drawer | 1b | todo | money-back branches: advrefund in 1c, refund/refundDiff in M2 |
| `renderDrawer` | 5525 | domain/drawer.ts, features/drawer | 1b | todo | money-back branches: advrefund in 1c, refund/refundDiff in M2 |
| `renderSettings` | 5873 | features/settings | M4 | deferred-M4 |  |
| `renderSim` | 5893 | features/sim | 1b | todo |  |
