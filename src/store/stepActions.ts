import { approvedOrders, selectedLines } from "../domain/lines";
import type { ActionId } from "../domain/steps";
import { activeStory } from "../domain/stories";
import type { Visit, World } from "../domain/types";
import * as A from "./actions";

/* what each nextStep() action id does — the closures v3 builds inside nextStep (lines 3025–3229).
   `openDrawer` opens the payment pop-up (UI state) and is handled by the step card. */
export const STEP_RUN: Partial<Record<ActionId, (w: World, c: Visit, fx: A.Fx) => void>> = {
  checkConsultApproval: A.simApproveConsult,
  billConsult: (w, c) => { A.startBill(w, c, "consult", [c.consult]); },
  billApproved: (w, c) => { A.startBill(w, c, "orders", selectedLines(c, approvedOrders(c))); },
  recordZero: (w, c, fx) => { A.payAll(w, c, "No charge", fx); },
  markLinkPaid: (w, c, fx) => { A.payAll(w, c, "Payment link", fx); },
  sendLink: (w, c, fx) => A.sendLink(w, c, fx),
  resendLink: A.resendLink,
  cancelBill: A.cancelBill,
  waitAll: A.waitAll,
  releaseHeld: A.releaseHeld,
  checkApproval: A.checkApproval,
  checkDoctor: A.checkDoctor,
  checkOrders: A.checkOrders,
  reopen: (_w, c) => { c.closed = false; },
  addOrders: (w, c, fx) => A.switchStory(w, c, "addorders", activeStory(w, c), fx),
};

/* entry points that belong to later work: shown where v3 has them, disabled */
export const STEP_LATER: Partial<Record<ActionId, string>> = {
  billCashUrgent: "M2", undoReplace: "M2", lwbs: "M3", undoLwbs: "M3", printPackage: "M3", voidPrint: "M3",
};
