import { firstName, payerOf, planOf, walletDocsOf } from "./lookup";
import { consultDone, creditInvoices, creditTotal, liveInvoices, ordersOpen, procOnly, refundable } from "./lines";
import { fmt } from "./money";
import { invoiceReplace, packageItemsLeft } from "./replace";
import { nextStep, type NextStep } from "./steps";
import type { HistoryEvent, Msg, StoryUiCtx, Visit, World } from "./types";

/* v3 lines 1908–1956. A visit is a set of stories, each with a FIXED list of stages.
   Titles and stage names are translated in the UI via `story.<id>.title` / `story.<id>.stages.<i>`. */
export const STORIES = {
  visit: { icon: "receipt", scope: "visit", stages: 5,
    events: ["VISIT", "APPROVAL", "CHECK", "LINK", "PAYMENT", "PAYER", "CLINICAL", "LWBS", "LINKCANCEL"] },
  orders: { icon: "flask", scope: "visit", stages: 5,
    events: ["ORDERS", "APPROVAL", "CHECK", "HOLD", "CASH_URGENT", "LINK", "PAYMENT", "PKGREADY", "LINKCANCEL"] },
  pkgvisit: { icon: "package", scope: "visit", stages: 2, events: ["PKGBOOK", "PKGPRINT", "VOID"] },
  refund: { icon: "receipt", scope: "visit", stages: 4, events: ["REFUND"] },
  replace: { icon: "replace", scope: "visit", stages: 4,
    events: ["REPLACE_START", "APPROVAL", "CHECK", "REPLACE", "REPLACE_CANCEL", "REFUND"] },
  package: { icon: "package", scope: "visit", stages: 3, events: ["PKGBOOK"] },
  credit: { icon: "card", scope: "patient", stages: 3, events: ["CREDIT"] },
  payer: { icon: "shield", scope: "visit", stages: 4, events: ["ELIGIBILITY", "PAYER"] },
  addorders: { icon: "plus", scope: "visit", stages: 3, events: ["ADDORDER"] },
  advadd: { icon: "wallet", scope: "patient", stages: 3, events: ["ADV_IN"] },
  advrefund: { icon: "undo", scope: "patient", stages: 4, events: ["ADV_REFUND"] },
  walkin: { icon: "plus", scope: "home", stages: 6, events: ["VISIT", "APPROVAL"] },
} as const;
export type StoryId = keyof typeof STORIES;

const EVENT_STORY: Record<string, StoryId> = {};
(Object.entries(STORIES) as [StoryId, (typeof STORIES)[StoryId]][]).forEach(([id, st]) =>
  st.events.forEach((e) => { if (!EVENT_STORY[e]) EVENT_STORY[e] = id; }));
/* events both invoicing stories share are told apart by what they were about */
const ORDER_TYPES = ["ORDERS", "HOLD", "CASH_URGENT", "PKGREADY"];
export function storyOfEvent(h: HistoryEvent): StoryId {
  if (h.story) return h.story as StoryId;
  if (h.type === "ADDORDER") return "addorders";
  if (h.type === "ADVANCE") return "advadd";
  if (h.type === "ADVREFUND") return "advrefund";
  if (h.type === "ELIGIBILITY" || h.type === "PAYER") return "payer";
  if (ORDER_TYPES.includes(h.type)) return "orders";
  if (["PAYMENT", "LINK", "LINKCANCEL"].includes(h.type)) return h.scope === "orders" ? "orders" : "visit";
  if (["APPROVAL", "CHECK"].includes(h.type)) return /order/i.test((h.tx || "") + (h.sub || "")) ? "orders" : "visit";
  return EVENT_STORY[h.type] || "visit";
}

/* the visit story owns everything up to the doctor starting; the rest is the orders story */
const VISIT_KEYS = ["CONSULT_WAIT", "CONSULT_BILL", "SEE_DOCTOR", "LWBS"];
export function isVisitStep(w: World, c: Visit, st?: NextStep) {
  st = st || nextStep(w, c);
  if (VISIT_KEYS.includes(st.key)) return true;
  return ["COLLECT", "COLLECT_WAIT", "COLLECT_ZERO"].includes(st.key) && !!c.bill && c.bill.scope === "consult";
}
export const visitDone = (w: World, c: Visit) => !!c.interbranch || procOnly(c) || (consultDone(c) && !isVisitStep(w, c));
export function mainStory(w: World, c: Visit): StoryId {
  if (c.fromPackage) return "pkgvisit";
  return visitDone(w, c) && ordersOpen(c) ? "orders" : "visit";
}
/* v3 line 2256 */
export const payerChangeable = (c: Visit) => !liveInvoices(c).length && !c.bill && !c.fromPackage;

/* the stories this visit needs right now, in a fixed order */
export function visitStories(w: World, c: Visit): StoryId[] {
  const done = c.storyDone || {};
  const out: StoryId[] = [];
  if (c.fromPackage) out.push("pkgvisit");
  else {
    if (!c.interbranch && !procOnly(c)) out.push("visit");
    out.push("orders");
  }
  if (c.invoices.length || (c.refundInvoices || []).length || walletDocsOf(w, c).length || done.refund) out.push("refund");
  const replaceable = liveInvoices(c).filter((i) => invoiceReplace(w, c, i));
  if (replaceable.length || (c.bill && c.bill.replacing) || done.replace) out.push("replace");
  if (packageItemsLeft(w, c.mrn).length || done.package) out.push("package");
  if (creditInvoices(w, c.mrn).length || done.credit) out.push("credit");
  if (!c.fromPackage && !c.interbranch && !c.lwbs && !c.closed) out.push("addorders");
  if ((c.payerStory && payerChangeable(c)) || done.payer) out.push("payer");
  return out;
}

export interface StagePos { index: number; skipped: number[]; complete?: boolean; locked?: boolean }

/* where a story is, as an index into its fixed stages (v3 lines 2056–2107) */
export function storyStage(w: World, c: Visit, id: StoryId, ui: StoryUiCtx = {}): StagePos {
  const done = (c.storyDone || {})[id];
  const last = STORIES[id].stages - 1;
  const drawerHere = ui.drawer && ui.drawer.caseId === c.id ? ui.drawer : null;
  if (id === "visit") {
    const st = nextStep(w, c);
    const skipped: number[] = [];
    if (!planOf(w, c)) skipped.push(0); /* self-pay: nothing to approve */
    if (c.consult.price === 0) skipped.push(2); /* no charge: nothing to collect */
    if (!isVisitStep(w, c, st)) return { index: last, skipped, complete: true };
    const map: Record<string, number> = { CONSULT_WAIT: 0, CONSULT_BILL: 1, SEE_DOCTOR: 3, LWBS: 3 };
    const index = map[st.key] !== undefined ? map[st.key]! : 2;
    const sk = skipped.filter((i) => i < index);
    if (st.key === "LWBS") sk.push(4); /* never reached the doctor */
    return { index, skipped: sk };
  }
  if (id === "orders") {
    const st = nextStep(w, c);
    if (!ordersOpen(c) || isVisitStep(w, c, st)) return { index: 0, skipped: [], locked: true };
    const map: Record<string, number> = { WAIT_DOCTOR: 0, NO_ORDERS: 0, ORDERS_WAIT: 1, ORDERS_MIXED: 2, ORDERS_BILL: 2, CLOSE: 4, CLOSED: 4 };
    let index = map[st.key];
    if (index === undefined) index = ["COLLECT", "COLLECT_WAIT", "COLLECT_ZERO"].includes(st.key) ? 3 : 0;
    const skipped = !planOf(w, c) && index > 1 ? [1] : []; /* self-pay orders need no approval */
    return { index, skipped };
  }
  if (id === "pkgvisit") return { index: nextStep(w, c).key === "PKG_DONE" ? 1 : 0, skipped: [] };
  if (id === "refund") {
    if (drawerHere && drawerHere.refund) return { index: 2, skipped: [] };
    if (ui.refundInvoiceId && c.invoices.some((i) => i.id === ui.refundInvoiceId)) return { index: 1, skipped: [] };
    return { index: done ? last : 0, skipped: [] };
  }
  if (id === "replace") {
    if (ui.replaceCaseId === c.id) return { index: 1, skipped: [] };
    if (c.bill && c.bill.replacing) return { index: 2, skipped: [] };
    if (drawerHere && drawerHere.refundDiff) return { index: 2, skipped: [] };
    return { index: done ? last : 0, skipped: [] };
  }
  if (id === "package") {
    const ps = c.pkgStory;
    return { index: done ? last : ps && ps.stage === 2 ? 1 : 0, skipped: [] };
  }
  if (id === "credit") {
    if (drawerHere && drawerHere.credit) return { index: 1, skipped: [] };
    return { index: done ? last : 0, skipped: [] };
  }
  if (id === "addorders") return { index: done ? last : c.addStory && c.addStory.stage === 2 ? 1 : 0, skipped: [] };
  if (id === "payer") {
    if (done && !c.payerStory) return { index: last, skipped: done.cash ? [2] : [] };
    const ps = c.payerStory || { stage: 1 };
    return { index: ps.stage - 1, skipped: ps.choice && ps.choice.kind === "Cash" && ps.stage > 3 ? [2] : [] };
  }
  return { index: 0, skipped: [] };
}

export const stageMsg = (id: StoryId, i: number): Msg => ({ k: `story.${id}.stages.${i}` });

/* what a story tab says about itself (v3 lines 2003–2017) */
export function storyBadge(w: World, c: Visit, id: StoryId, ui: StoryUiCtx = {}): Msg {
  if (id === "refund") {
    const n = c.invoices.length, r = c.invoices.filter((i) => refundable(w, i)).length;
    return r ? { k: "badge.invoicesRefundable", p: { count: n, r } } : { k: "badge.invoices", p: { count: n } };
  }
  if (id === "replace") {
    const r = liveInvoices(c).filter((i) => invoiceReplace(w, c, i));
    const ready = r.filter((i) => invoiceReplace(w, c, i)!.ok).length;
    return ready ? { k: "badge.ready", p: { count: ready } } : { k: "badge.waiting", p: { count: r.length } };
  }
  if (id === "package") return { k: "badge.toBook", p: { count: packageItemsLeft(w, c.mrn).length } };
  if (id === "credit") return { k: "badge.plain", p: { text: fmt(creditTotal(w, c.mrn)) } };
  if (id === "payer") return c.payerStory ? stageMsg("payer", storyStage(w, c, "payer", ui).index) : { k: "badge.plain", p: { text: payerOf(w, c).label } };
  if (id === "addorders") {
    const n = c.orders.filter((o) => o.byReception).length;
    return n ? { k: "badge.added", p: { count: n } } : { k: "badge.packagesTests" };
  }
  if (c.lwbs && id === "visit") return { k: "badge.lwbs" };
  if (id === "visit" && visitDone(w, c)) return { k: "badge.invoicedWithDoctor" };
  if (id === "orders" && !ordersOpen(c)) return { k: "badge.ordersLocked" };
  return stageMsg(id, storyStage(w, c, id, ui).index);
}

/* a story that money is already moving through holds the others back */
export function storyLock(c: Visit, id: StoryId): Msg | null {
  if (c.bill && c.bill.replacing && id !== "replace") return { k: "lock.finishReplacement" };
  if (c.bill && !c.bill.replacing && id === "replace") return { k: "lock.finishPayment" };
  if (id === "orders" && !ordersOpen(c)) return { k: c.lwbs ? "lock.lwbs" : "lock.ordersLocked" };
  return null;
}

/* the story to show — v3 activeStory() without the mutation; the store writes the result back */
export function activeStory(w: World, c: Visit): StoryId {
  const list = visitStories(w, c);
  if (c.bill && c.bill.replacing) return "replace";
  let a = c.activeStory as StoryId | null | undefined;
  if (!a || !list.includes(a) || storyLock(c, a)) a = mainStory(w, c);
  /* once the visit story is finished the orders story takes over — unless the receptionist chose to look back */
  if (a === "visit" && mainStory(w, c) === "orders" && !c.visitPinned) a = "orders";
  return a;
}

/* a finished story shows its result until you leave it; if there is more to do it then starts afresh */
export function storyHasWork(w: World, c: Visit, id: StoryId) {
  if (id === "refund") return liveInvoices(c).some((i) => refundable(w, i));
  if (id === "replace") return liveInvoices(c).some((i) => invoiceReplace(w, c, i));
  if (id === "package") return packageItemsLeft(w, c.mrn).length > 0;
  if (id === "credit") return creditInvoices(w, c.mrn).length > 0;
  if (id === "addorders") return true; /* more can always be added */
  return false;
}

export const storyFirstName = firstName;
