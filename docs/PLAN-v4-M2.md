# VIDA OPD Billing v4 — Milestone 2 plan (Add orders · Refund · Replace)

Milestone 2 ports the three visit stories M1 left as "Coming in M2". Everything in `docs/PLAN-v4-M1.md` §0–§6
(session protocol, locked decisions, environment, architecture, UI system, goldens, drift) still applies —
read it first. Commits are `M2<x>: <summary>`; WIP branches `m2<x>-wip`; handoff notes at the bottom of this file.

## Scope
| Checkpoint | Story | v3 source (line) |
|---|---|---|
| 2a | **Add orders** — reception adds tests/packages that need no doctor | `renderAddOrdersStory` 2218, `addReceptionOrders` 2206 (ported in 1c), `renderOrderPicker` 2176 (ported in 1c), `NO_ORDERS` "Add orders" 3204 |
| 2b | **Refund** — choose the invoice, lines & reason in the card, mode in the slide-in, refund invoice | `renderRefundStory` 2825, `openRefund` 5192, `refundCalc` 5205, `refundInline` 5216, `refundAmtHtml/ReasonHtml/ListHtml` 5219–5260, `renderRefundWork` 5277, `completeRefund` 5302, `raiseRefundInvoice` 4452, `renderRefundInvoicePop` 5331, drawer `d.refund` branch 5602/5834, `dropInlineRefund` 3417 |
| 2c | **Replace** — move invoices between cash and insurance; urgent cash billing | `billedLines` 1345, `replaceLinesFor` 1350, `replacePreview` 1356, `undoReplace` 1385, `doReplace` 1410, `checkInsurerApproval` 1475, `invoiceReplace` 1499 (ported), `payAll` replacing branch 1703/1738, `cancelBill` → `undoReplace` 1656, `renderReplaceStory` 2871, `replaceInline/renderReplaceWork/renderReplacePop` 5005–5096, drawer `d.refundDiff` branch 5593/5800, `REPLACE_COLLECT` (ported), `billCashUrgent` → `startCashBill` 3178 |

## Porting rules specific to M2
- v3 keeps the refund / replace work in global UI state (`state.refund`, `state.replace`). In v4 they live in the UI
  store (`ui.refund = { id, sel, reason, linesOpen }`, `ui.replace = { caseId, to, payerId, codes, partial }`) and
  feed `StoryUiCtx.refundInvoiceId` / `replaceCaseId`. Leaving the visit (open another visit / patient / home) drops
  them, as `dropInlineRefund` does. Work started outside the visit (invoice table, invoice / event pop-ups) always
  lands on the visit's story first (`openRefund`), so v3's pop-up variant of Replace is not needed.
- Actions stay plain `(w, c, …, fx)` functions: `store/refund.ts` (refundCalc, completeRefund, raiseRefundInvoice),
  `store/replace.ts` (doReplace, undoReplace, checkInsurerApproval, refundDiff completion). `doReplace` returns
  `{ refundDiff: amount }` when the patient is owed money, and the UI opens the drawer (v3 sets `state.drawer` itself).
- Refund invoice ids are `RFD-` + the same seeded random as invoice ids (`domain/ids.ts`), so golden flows match.
- Drawer: `DrawerState.refund = { id, codes, reason, dedBack }` and `.refundDiff = { reason, to }` join `advRefund`
  as money-back branches (`isMoneyBack`). Closing a `refundDiff` drawer abandons the replacement (`undoReplace`).

## Golden flows (add to `FLOWS` in `tools/v3-golden/extract.html`, replay in `flows.test.ts`)
- 2a: add orders on a visit through the story (`addOrdersStory`).
- 2b: refund one line of a paid invoice by cash; refund a whole invoice to the advance wallet.
- 2c: urgent cash bill → pay → approval → replace onto the policy (collect / nothing to settle); a cash visit's
  orders invoice replaced onto an insurer after `checkInsurerApproval` ×2; a replacement that refunds the
  difference (refundDiff); a replacement abandoned (`undoReplace`).

## Acceptance
- [x] 2a: Add orders story — picker (trending, search, doctor-only locked), review with total, "Add N order(s)" adds
  lines (`byReception`, cash price), done card "Add more orders"; NO_ORDERS "Add orders" opens it; golden + e2e.
- [x] 2b: Refund story lists the visit's invoices, refund invoices and wallet docs; Refund buttons exactly on
  `refundable` invoices; lines & reason in the card (all refundable lines ticked, reason ≥ 3 chars), refund mode in
  the slide-in (Cash / card modes / Advance wallet; no Credit); refund invoice RFD-… with its own pop-up; invoice
  shows "Refunds against this invoice"; Refund entry points in invoice table / invoice pop-up / event pop-up work;
  stages Invoices → Lines & reason → Refund mode → Done; golden + e2e.
- [x] 2c: Replace story — insured: cash-billed orders, "Check approval", Replace once approved; cash patient: one
  invoice at a time onto the best insurer, insurer Select with "n of m approved", `checkInsurerApproval` on the second
  check; work card with table, summary and "Replace · collect / refund / nothing to settle"; REPLACE_COLLECT step
  collects the difference; refund-difference drawer; cancel / walk-away → `undoReplace`; "Bill the N pending order(s)
  as cash now" enabled; golden + e2e.
- [x] `npm run verify` green; PARITY.md updated (no `deferred-M2` left); AGENTS.md "Learned in M2".

---

## Handoff notes
_(append here when stopping mid-checkpoint; delete when the checkpoint closes)_
