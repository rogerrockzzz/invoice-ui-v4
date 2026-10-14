import { firstName, payerName, payerOf, planOf, pt, visitsOf } from "./lookup";
import {
  approvedOrders, collected, consultDone, doctorOrders, due, liveInvoices, onBill, pendingOrders,
  procOnly, refundable, selectedLines, visitCredit, visitCreditTot,
} from "./lines";
import { fmt, round2 } from "./money";
import { isPending, priceLines } from "./pricing";
import { isFuture, isToday } from "./visits";
import type { Line, Msg, Visit, World } from "./types";

/* v3 nextStep() (lines 3025–3229), returning data only. Every text is an i18n key + params; a param may
   itself be a Msg (translated by the UI) or "" when that part of the sentence is absent. */

export type StepKey =
  | "CONSULT_WAIT" | "CONSULT_BILL" | "COLLECT_ZERO" | "REPLACE_COLLECT" | "COLLECT_WAIT" | "COLLECT"
  | "PKG_PRINT" | "PKG_DONE" | "ORDERS_MIXED" | "ORDERS_BILL" | "ORDERS_WAIT" | "LWBS" | "SEE_DOCTOR"
  | "NO_ORDERS" | "WAIT_DOCTOR" | "CLOSE" | "CLOSED";

export type ActionId =
  | "checkConsultApproval" | "billConsult" | "recordZero" | "openDrawer" | "sendLink" | "undoReplace"
  | "resendLink" | "markLinkPaid" | "printPackage" | "voidPrint" | "billApproved" | "waitAll" | "checkApproval"
  | "releaseHeld" | "billCashUrgent" | "undoLwbs" | "checkDoctor" | "lwbs" | "addOrders" | "checkOrders"
  | "reopen" | "cancelBill";

export type ActionVariant = "yes" | "no" | "primary" | "danger" | "ghost" | "default";
export interface StepAction { id: ActionId; label: Msg; variant: ActionVariant }

export interface NextStep {
  key: StepKey;
  tone: "" | "wait" | "done";
  tag: Msg;
  q: Msg;
  sub: Msg;
  amt?: number;
  amtLabel?: Msg;
  amts?: { v: number; label: Msg; tone: "due" | "soft" }[];
  ext?: { title: Msg; lines: Line[]; selectable?: boolean; note?: Msg | null; open?: boolean };
  actions: StepAction[];
  back?: ActionId;
}

const m = (k: string, p?: Msg["p"]): Msg => (p ? { k, p } : { k });
const act = (id: ActionId, label: Msg, variant: ActionVariant = "default"): StepAction => ({ id, label, variant });

export function nextStep(w: World, c: Visit): NextStep {
  const owed = due(c);
  const insured = !!planOf(w, c); /* no policy → nothing to approve */
  const appr = approvedOrders(c), pend = pendingOrders(c);
  const first = firstName(w, c);

  if (!consultDone(c)) {
    if (isPending(c.consult)) return {
      key: "CONSULT_WAIT", tone: "wait", tag: m("step.tag.consultation"),
      q: m("step.consultWait.q"), sub: m("step.consultWait.sub", { payer: payerName(w, c) }),
      actions: [act("checkConsultApproval", m("step.act.checkForApproval"), "primary")],
    };
    const t = priceLines(w, c, [c.consult]);
    return {
      key: "CONSULT_BILL", tone: "", tag: m("step.tag.consultation"),
      q: m(insured ? "step.consultBill.qInsured" : "step.consultBill.q"),
      sub: t.patient === 0
        ? m("step.consultBill.subZero", { name: c.consult.name })
        : m("step.consultBill.sub", { name: c.consult.name, status: insured ? m(`ins.${c.consult.ins || "notinsured"}`) : m("step.selfPay") }),
      amt: t.patient, amtLabel: m("step.amt.patientShare"),
      ext: { title: m("step.ext.charged"), lines: [c.consult] },
      actions: [act("billConsult", m("step.act.yesBillIt"), "yes")],
    };
  }

  /* a follow-up or courtesy line that carries no charge — nothing to collect */
  if (c.bill && owed === 0) return {
    key: "COLLECT_ZERO", tone: "", tag: m("step.tag.nothingToCollect"),
    q: c.bill.scope === "consult" ? m("step.collectZero.qConsult", { name: c.consult.name, first }) : m("step.collectZero.qOrders", { first }),
    sub: m("step.collectZero.sub"), amt: 0, amtLabel: m("step.amt.patientShare"),
    ext: { title: m("step.ext.recorded"), lines: [c.consult, ...c.orders].filter((l) => onBill(c, l)) },
    actions: [act("recordZero", m("step.act.yesRecordIt"), "yes")], back: "cancelBill",
  };

  /* a replacement in hand: only the difference changes hands */
  if (c.bill && c.bill.replacing) {
    const rp = c.bill.replacing, t = rp.to, dif = due(c);
    const main = rp.partial
      ? (t === "cash" ? m("step.replace.partialCash", { payer: payerOf(w, c).label }) : m("step.replace.partialIns"))
      : m(t === "cash" ? "step.replace.wholeCash" : "step.replace.wholeIns");
    return {
      key: "REPLACE_COLLECT", tone: "", tag: m("step.tag.replacement"),
      q: m("step.replace.q", { amount: fmt(dif) }),
      sub: rp.credited > 0
        ? m("step.replace.subCarried", { main, total: fmt(c.bill.patient), credited: fmt(rp.credited) })
        : m("step.replace.sub", { main, total: fmt(c.bill.patient) }),
      amt: dif, amtLabel: m("step.amt.difference"),
      ext: { title: m("step.ext.newInvoiceLines", { count: c.bill.rows.length }), lines: [c.consult, ...c.orders].filter((l) => c.bill!.codes.includes(l.code)) },
      actions: [
        act("openDrawer", m("step.act.takeAtDesk"), "primary"),
        act("sendLink", m("step.act.sendAPaymentLink")),
        act("undoReplace", m("step.act.cancelReplacement"), "ghost"),
      ],
      back: "undoReplace",
    };
  }

  if (owed > 0) {
    if (c.link) return {
      key: "COLLECT_WAIT", tone: "wait", tag: m("step.tag.payment"),
      q: m("step.collectWait.q", { first, amount: fmt(owed) }),
      sub: c.link.ageMin >= 10
        ? m("step.collectWait.subStale", { at: c.link.at, mobile: pt(w, c).mobile, min: c.link.ageMin })
        : m("step.collectWait.sub", { at: c.link.at, mobile: pt(w, c).mobile }),
      amt: owed, amtLabel: m("step.amt.awaiting"),
      actions: [
        act("openDrawer", m("step.act.takePaymentAtDesk"), "primary"),
        act("resendLink", m("step.act.resendLink")),
        act("markLinkPaid", m("step.act.markLinkPaid"), "ghost"),
      ],
      back: "cancelBill",
    };
    const bill = c.bill!;
    return {
      key: "COLLECT", tone: "", tag: m("step.tag.payment"),
      q: m("step.collect.q", { first, scope: m(bill.scope === "consult" ? "step.scope.consultation" : "step.scope.orders"), amount: fmt(owed) }),
      sub: m("step.collect.sub"), amt: owed, amtLabel: m("step.amt.toCollect"),
      actions: [act("openDrawer", m("step.act.takePaymentAtDesk"), "yes"), act("sendLink", m("step.act.sendPaymentLink"), "no")],
      back: "cancelBill",
      /* the charge is not an invoice yet, so a line can still be dropped here */
      ext: {
        title: m("step.ext.charged"), selectable: bill.scope === "orders",
        lines: [c.consult, ...c.orders].filter((l) => onBill(c, l) ||
          (bill.scope === "orders" && !l.invoiceId && l !== c.consult && (c.sel || {})[l.code] === false)),
      },
    };
  }

  /* a package procedure was paid inside the package — this is a print, not a charge */
  if (c.fromPackage && appr.length) {
    const src = appr[0]!.fromPackage || {};
    return {
      key: "PKG_PRINT", tone: "", tag: m("step.tag.packageProcedure"),
      q: m("step.pkgPrint.q", { count: appr.length }),
      sub: m("step.pkgPrint.sub", { names: appr.map((o) => o.name).join(", "), parent: src.parent || m("step.pkgPrint.thePackage"), invoice: src.invoiceId || "" }),
      ext: { title: m("step.ext.fromPackage", { count: appr.length }), lines: appr },
      actions: [act("printPackage", m("step.act.yesPrintIt"), "yes")],
    };
  }
  if (c.fromPackage && !appr.length && !pend.length) {
    const inv = c.invoices.find((i) => !i.voided);
    if (inv) {
      const src = (c.orders[0] || ({} as Line)).fromPackage || {};
      return {
        key: "PKG_DONE", tone: "done", tag: m("step.tag.packageProcedure"),
        q: m("step.pkgDone.q"), sub: m("step.pkgDone.sub", { inv: inv.id, src: src.invoiceId || "" }),
        actions: [act("voidPrint", m("step.act.undoPrint", { inv: inv.id }), "danger")],
      };
    }
  }

  if (appr.length || pend.length) {
    const chosen = selectedLines(c, appr); /* all ticked by default */
    const t = priceLines(w, c, chosen);
    const someOff = chosen.length < appr.length;
    const ibTag = m(c.interbranch ? "step.tag.interbranch" : "step.tag.doctorsOrders");
    const at = c.interbranch ? m("step.orders.at", { branch: c.fromBranch || "" }) : "";
    const behalf = c.interbranch ? m("step.orders.behalf", { branch: c.fromBranch || "" }) : "";
    if (appr.length && pend.length && !c.prefs.waitAll) {
      const done = c.orders.filter((o) => o.invoiceId).length;
      return {
        key: "ORDERS_MIXED", tone: "", tag: ibTag,
        q: m("step.mixed.q", {
          unpaid: c.orders.filter((o) => !o.paid).length, at, appr: appr.length, pend: pend.length,
          has: m(appr.length === 1 ? "step.word.has" : "step.word.have"), does: m(pend.length === 1 ? "step.word.does" : "step.word.do"),
        }),
        sub: c.interbranch ? m("step.orders.behalfAlone", { branch: c.fromBranch || "" }) : m("step.mixed.sub"),
        amt: t.patient,
        amtLabel: someOff ? m("step.amt.someOfApproved", { chosen: chosen.length, appr: appr.length }) : m("step.amt.approvedShare", { appr: appr.length }),
        ext: {
          title: m("step.ext.stillToBill", { count: appr.length + pend.length }), lines: [...appr, ...pend], selectable: true,
          note: done ? m("step.ext.earlierBilled", { count: done }) : null,
        },
        actions: [
          act("billApproved", m(insured ? "step.act.billApprovedNow" : "step.act.billNow", { count: chosen.length }), "yes"),
          act("waitAll", m("step.act.waitAll"), "no"),
        ],
      };
    }
    if (appr.length && !pend.length) return {
      key: "ORDERS_BILL", tone: "", tag: ibTag,
      q: m("step.bill.q", {
        count: appr.length, at, approved: insured ? m("step.bill.areApproved") : "",
        what: someOff ? m("step.bill.theTicked", { count: chosen.length }) : m("step.bill.them"),
      }),
      sub: m("step.bill.sub", { main: m(insured ? "step.bill.nothingWaiting" : "step.bill.selfPay"), behalf }),
      amt: t.patient,
      amtLabel: someOff ? m("step.amt.someOfTicked", { chosen: chosen.length, appr: appr.length }) : m("step.amt.patientShare"),
      ext: { title: m("step.ext.orders", { count: appr.length }), lines: appr, selectable: true, open: someOff },
      actions: [act("billApproved", someOff ? m("step.act.yesBillTicked", { count: chosen.length }) : m("step.act.yesBillThem"), "yes")],
    };

    /* still waiting on the payer — one button, and it reports what came back */
    const checked = c.lastCheck;
    const cashable = pend.filter((o) => !o.paid && !o.invoiceId);
    const heldLines = c.prefs.waitAll ? appr : [];
    const held = heldLines.length ? priceLines(w, c, heldLines).patient : 0;
    const all = priceLines(w, c, [...heldLines, ...pend.map((o) => ({ ...o, ins: "approved" as const }))]).patient;
    return {
      key: "ORDERS_WAIT", tone: "wait", tag: m(c.interbranch ? "step.tag.interbranch" : "step.tag.remainingOrders"),
      q: m("step.wait.q", { count: pend.length }),
      sub: m("step.wait.sub", {
        checked: checked ? m("step.wait.checked", { at: checked }) : "",
        held: c.prefs.waitAll && appr.length ? m("step.wait.held", { count: appr.length }) : "",
      }),
      amts: [
        ...(held ? [{ v: held, label: m("step.amt.readyToBill", { count: appr.length }), tone: "due" as const }] : []),
        { v: round2(all - held), label: m("step.amt.upToMore"), tone: "soft" as const },
      ],
      ext: { title: m("step.ext.awaitingApproval", { count: pend.length }), lines: pend },
      actions: [
        act("checkApproval", m("step.act.checkApproval"), "primary"),
        ...(c.prefs.waitAll && appr.length ? [act("releaseHeld", m("step.act.releaseHeld", { count: appr.length }))] : []),
        ...(cashable.length ? [act("billCashUrgent", m("step.act.billCashUrgent", { count: cashable.length }))] : []),
      ],
    };
  }

  /* the patient left before the doctor saw them */
  if (c.lwbs) return {
    key: "LWBS", tone: "wait", tag: m("step.tag.lwbs"),
    q: m("step.lwbs.q", { first }),
    sub: m("step.lwbs.sub", {
      at: c.lwbs.at, by: c.lwbs.by, reason: c.lwbs.reason ? ` · ${c.lwbs.reason}` : "",
      refund: liveInvoices(c).some((i) => refundable(w, i)) ? m("step.lwbs.stillPaid") : "",
    }),
    actions: [act("undoLwbs", m("step.act.undoLwbs"), "ghost")],
  };

  /* consultation settled — the patient goes to the doctor; nothing moves until the doctor starts */
  if (!c.closed && !doctorOrders(c).length && !c.interbranch && !procOnly(c) && consultDone(c) && !c.clinical) return {
    key: "SEE_DOCTOR", tone: "wait", tag: m("step.tag.seeDoctor"),
    q: m("step.seeDoctor.q", { first }),
    sub: m("step.seeDoctor.sub", { checked: c.lastDocCheck ? m("step.seeDoctor.checked", { at: c.lastDocCheck }) : "" }),
    actions: [act("checkDoctor", m("step.act.checkDoctor"), "primary"), act("lwbs", m("step.act.lwbs"), "ghost")],
  };

  /* a procedure-only visit has no doctor step: it waits for reception to add what is being done */
  if (!c.closed && procOnly(c) && !c.orders.length && !c.fromPackage) return {
    key: "NO_ORDERS", tone: "", tag: m("step.tag.orders"),
    q: m("step.noOrders.q"), sub: m("step.noOrders.sub", { first }),
    actions: [act("addOrders", m("step.act.addOrders"), "primary")],
  };

  /* consultation settled and the doctor has not ordered anything yet — the visit stays open */
  if (!c.closed && !c.orders.length && !c.interbranch && consultDone(c)) return {
    key: "WAIT_DOCTOR", tone: "wait", tag: m("step.tag.withDoctor"),
    q: m("step.waitDoctor.q", { first }),
    sub: m("step.waitDoctor.sub", { checked: c.lastOrderCheck ? m("step.waitDoctor.checked", { at: c.lastOrderCheck }) : "" }),
    actions: [act("checkOrders", m("step.act.checkOrders"), "primary")],
  };

  const onCredit = visitCredit(c), creditHere = visitCreditTot(c);
  if (!c.closed) return {
    key: "CLOSE", tone: "done", tag: m("step.tag.ordersComplete"),
    q: m(onCredit.length ? "step.close.qCredit" : "step.close.q"),
    sub: m("step.close.sub", {
      collected: fmt(collected(c)), count: c.invoices.length,
      credit: onCredit.length ? m("step.close.credit", { amount: fmt(creditHere), count: onCredit.length }) : "",
      checked: c.lastOrderCheck ? m("step.close.checked", { at: c.lastOrderCheck }) : "",
    }),
    actions: [act("checkOrders", m("step.act.checkOrders"), "primary")],
  };

  return {
    key: "CLOSED", tone: "done", tag: m("step.tag.closed"),
    q: m("step.closed.q"), sub: m("step.closed.sub", { collected: fmt(collected(c)) }),
    actions: [act("reopen", m("step.act.reopen"), "ghost")],
  };
}

/* v3 lines 3305–3311 */
export type PendingKind = "act" | "wait" | "ongoing" | "done";
const ACT_KEYS: StepKey[] = ["CONSULT_BILL", "ORDERS_MIXED", "ORDERS_BILL", "COLLECT", "COLLECT_ZERO", "PKG_PRINT", "NO_ORDERS"];
const WAIT_KEYS: StepKey[] = ["CONSULT_WAIT", "COLLECT_WAIT", "ORDERS_WAIT", "SEE_DOCTOR"];
export function pendingSummary(w: World, c: Visit) {
  const s = nextStep(w, c);
  const kind: PendingKind = ACT_KEYS.includes(s.key) ? "act" : WAIT_KEYS.includes(s.key) ? "wait" : s.key === "WAIT_DOCTOR" ? "ongoing" : "done";
  return { s, kind, owed: due(c) };
}
export type PendingItem = { c: Visit } & ReturnType<typeof pendingSummary>;

/* v3 lines 3262–3267: the open visits with something to do or wait for, sorted into today / upcoming / earlier */
export function pendingVisits(w: World, mrn: string) {
  const open: PendingItem[] = visitsOf(w, mrn).filter((c) => !c.closed).map((c) => ({ c, ...pendingSummary(w, c) })).filter((x) => x.kind !== "done");
  return {
    today: open.filter((x) => isToday(x.c)),
    upcoming: open.filter((x) => isFuture(x.c)).sort((a, b) => (a.c.sortKey || 0) - (b.c.sortKey || 0)),
    earlier: open.filter((x) => !isToday(x.c) && !isFuture(x.c)),
  };
}
