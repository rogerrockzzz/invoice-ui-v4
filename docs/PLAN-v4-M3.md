# VIDA OPD Billing v4 — Milestone 3 plan (LWBS · Package booking · Package procedure)

Milestone 3 ports the last visit stories M1/M2 left as "Coming in M3". Everything in `docs/PLAN-v4-M1.md` §0–§6
(session protocol, locked decisions, environment, architecture, UI system, goldens, drift) still applies —
read it first. Commits are `M3<x>: <summary>`; WIP branches `m3<x>-wip`; handoff notes at the bottom of this file.

The domain side is already in place from 1a (`nextStep` keys `LWBS` / `PKG_PRINT` / `PKG_DONE`, `storyStage`
for `package` / `pkgvisit`, `packageItems(Left)`, `liveInvoices` skipping package prints, `invType`, the invoice
pop-up's "Paid inside" / "Void" lines). M3 adds the actions, the UI and the golden flows.

## Scope
| Checkpoint | Story | v3 source (line) |
|---|---|---|
| 3a | **LWBS** — the patient left before the doctor saw them; undo when they come back | `markLwbs` 1827, `undoLwbs` 1835, `renderLwbsPop` 1841, `SEE_DOCTOR` "Left without being seen" 3197, `LWBS` step 3183 |
| 3b | **Package booking** — a paid package's procedures booked as their own nil-priced visit | `renderPackageStory` 2907, `openPkgBook` 5099, `renderPkgBookPop` 5108, `createPkgVisit` 5163, `renderPackageItems` 4789 (book / open actions), done card "Open the new visit" |
| 3c | **Package procedure** — the package visit prints its invoice at no charge; the print can be undone | `printPackageOrders` 4932, `renderVoidPop` 4953, `voidPrint` 4989, `PKG_PRINT` / `PKG_DONE` 3098–3116 |

## Porting rules specific to M3
- v3's pop-up state (`state.lwbsPop`, `state.pkgBook`, `state.voidPop`) lives in the UI store as
  `ui.lwbsPop = { caseId, reason }`, `ui.pkgBook = { mrn, sel, clinic, doctor }`, `ui.voidPop = { caseId, invId, reason }`.
  The story's own state (`c.pkgStory = { stage, sel, clinic, doctor, listOpen }`) stays on the visit, as v3 does.
- Actions are plain `(w, c, …, fx)` functions: `markLwbs` / `undoLwbs` in `store/actions.ts`; `createPkgVisit`,
  `bookPackageStory`, `printPackageOrders`, `voidPrint` in `store/package.ts`. `createPkgVisit` returns the new
  visit's id (never a draft); the pop-up variant opens it (v3 `openVisit`), the story variant stays.
- Step actions: `undoLwbs` and `printPackage` run through `STEP_RUN`; `lwbs` and `voidPrint` open their pop-ups
  (UI state, handled by the step card like `openDrawer`). `STEP_LATER` is empty after M3.
- The package visit's id comes from `nextVisitId()` (same counter as walk-ins); the print's invoice id from the
  seeded `newInvoiceId()`, so golden flows stay deterministic.

## Golden flows (add to `FLOWS` in `tools/v3-golden/extract.html`, replay in `flows.test.ts`)
- 3a: LWBS from the pop-up with a reason, undo, LWBS with no reason (drives `#lwGo`).
- 3b: package story on visit 2 (two procedures, other clinic / doctor, `#pkGo`) → new visit; profile pop-up on
  visit 4's patient (`openPkgBook` + `#pbGo`).
- 3c: print on the new package visit (`PKG_PRINT` yes), undo the print from the void pop-up (`#vdGo`), print again.

## Acceptance
- [x] 3a: "Left without being seen" on SEE_DOCTOR opens the pop-up (four reasons, refund hint when the consultation
  is refundable, "Keep waiting" / "Mark as LWBS"); LWBS step with undo; visit badge "Left without being seen",
  orders locked with the LWBS reason, Add orders hidden, visits list "LWBS"; golden + e2e.
- [ ] 3b: Package story — first procedure suggested, "Choose other procedures" list, stage 2 clinic & doctor, "Book the
  visit" creates the Package procedure visit and the done card opens it; profile "Package procedures" card offers
  "book a visit ›" / "Book a visit" / "Open visit"; pop-up with list, hint for already-booked, clinic & doctor,
  "Create the visit · N procedure(s)" opens the new visit; golden + e2e.
- [ ] 3c: Package procedure visit — PKG_PRINT "Yes, print it" raises a nil invoice (via Package, "Paid inside"), PKG_DONE
  "Undo the print · INV-…" opens the void pop-up (reason ≥ 3 chars), the invoice shows Void and the procedure can be
  printed again; golden + e2e.
- [ ] `npm run verify` green; PARITY.md updated (no `deferred-M3` left); AGENTS.md "Learned in M3".

---

## Handoff notes
_(append here when stopping mid-checkpoint; delete when the checkpoint closes)_
