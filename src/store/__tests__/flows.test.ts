import { describe, expect, it } from "vitest";
import golden from "../../domain/__golden__/v3.json";
import { createWorld } from "../../data/world";
import i18n from "../../i18n";
import { resolveMsg } from "../../i18n/msg";
import { setClock } from "../../domain/clock";
import { setRandom } from "../../domain/ids";
import { CONSULT_FEES, ORDER_CATALOG } from "../../domain/constants";
import { approvedOrders, creditInvoices, creditOf, creditTotal, due, pendingOrders, selectedLines } from "../../domain/lines";
import { visitsOf } from "../../domain/lookup";
import { round2 } from "../../domain/money";
import * as P from "../../domain/payers";
import { nextStep } from "../../domain/steps";
import { activeStory, storyStage, visitStories } from "../../domain/stories";
import type { AdvCat, PayerDecision, PayerDraft, Visit, World } from "../../domain/types";
import * as A from "../actions";
import * as PA from "../payer";
import * as W from "../wallet";

/* Replays the scripted flows of tools/v3-golden/extract.html with v4's actions and compares the visit
   after every op with what v3 itself produced: steps, stages, bills, invoices, history, wallet, ledger. */
const t = i18n.t.bind(i18n);
const text = (m: Parameters<typeof resolveMsg>[1]) => resolveMsg(t, m);
const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().replace(/\b\d\d:\d\d\b/g, "HH:MM");
const fx: A.Fx = { toast: () => {} };

type Op = [string, number, ...unknown[]];
/* the payer story's choices, as the UI makes them (domain/payers.ts) */
function choose(w: World, c: Visit | PayerDraft, spec: string, apply: () => void) {
  const ps = c.payerStory!;
  if (spec.startsWith("manual:")) {
    const [, query, id, ref] = spec.split(":");
    P.startManual(ps); P.editPayerField(ps, "group", query!); P.pickDirectory(ps, id!); P.editPayerField(ps, "policyNo", ref!);
    if (P.payerReady(ps)) apply();
    return;
  }
  const o = P.payerOptions(w, c.mrn, ps).all.find((x) => x.id === spec)!;
  if (P.choosePayer(ps, o)) apply();
}
function runOp(w: World, [op, id, ...a]: Op) {
  const c = w.cases.find((x) => x.id === id)!;
  switch (op) {
    case "addAdvance": return W.addAdvance(w, c.mrn, c.id, a[0] as AdvCat, a[1] as string, a[2] as number, fx);
    case "refundAdvance": return W.refundAdvance(w, c.mrn, c.id, a[0] as AdvCat, a[1] as number, a[2] as string, a[3] as string, "", fx);
    case "settleCredit": {
      const ids = a[1] === "first" ? [creditInvoices(w, c.mrn)[0]!.inv.id] : (a[1] as string[] | null);
      const amount = round2(creditInvoices(w, c.mrn).filter((x) => !ids || ids.includes(x.inv.id)).reduce((s, x) => s + creditOf(x.inv), 0));
      return W.settleCredit(w, c.mrn, a[2] as number | null, a[0] as string, amount, ids, "", fx);
    }
    case "creditLink": return W.creditLink(w, c, Object.keys(W.creditSel(w, c)), fx);
    case "openCreditPicker": return W.openCreditPicker(w, c);
    case "eligibility": return PA.startPayerStory(w, c, fx) && PA.finishEligibility(c);
    case "choosePayer": return choose(w, c, a[0] as string, () => PA.applyPayer(w, c, fx));
    case "savePayer": return P.payerReady(c.payerStory!) && PA.applyPayer(w, c, fx);
    case "manualPick": return choose(w, c, `manual:${a.join(":")}`, () => PA.applyPayer(w, c, fx));
    case "setPayer": return PA.setPayer(w, c, a[0] as string, fx);
    case "reprint": return W.reprint(w, a[0] === "first" ? c.invoices[0]!.id : (a[0] as string), fx);
    case "addOrders": return PA.addReceptionOrders(c, (a[0] as string[]).map((k) => ORDER_CATALOG.find((x) => x.code === k)!));
    case "walkin": {
      const sp = a[0] as { mrn: string; type: string; clinic: string; doctor: string; slot: string | null; payer: string; items: string[] };
      const d = PA.payerDraft(sp.mrn, CONSULT_FEES[sp.clinic] || 200, w.patients[sp.mrn]!.activePayerId || null);
      if (sp.type === "Procedure only") d.consult.price = 0;
      PA.finishEligibility(d);
      let decision: PayerDecision | null = null;
      choose(w, d, sp.payer, () => { decision = PA.draftDecide(d); });
      if (!decision && d.payerStory && P.payerReady(d.payerStory)) decision = PA.draftDecide(d);
      return PA.createWalkinVisit(w, { ...sp, payerDecision: decision, draftHistory: d.history, items: P.cartItems({ sel: Object.fromEntries(sp.items.map((k) => [k, true])) }) }, fx);
    }
    case "billConsult": return A.startBill(w, c, "consult", [c.consult]);
    case "billApproved": return A.startBill(w, c, "orders", selectedLines(c, approvedOrders(c)));
    case "approveConsult": return A.simApproveConsult(w, c, fx);
    case "waitAll": return A.waitAll(w, c);
    case "release": return A.releaseHeld(w, c, fx);
    case "toggle": return A.toggleLine(w, c, a[0] as string, nextStep(w, c).ext!.lines, fx);
    case "cashBill": return A.startCashBill(w, c, pendingOrders(c).filter((o) => !o.paid && !o.invoiceId));
    case "markLinkPaid": return A.payAll(w, c, "Payment link", fx);
    case "pay": {
      const [via, detail, spec] = a as [string, string | null, [string, number | "rest", string?, string?][] | null];
      let parts = null;
      if (spec) {
        const fixed = spec.filter((p) => p[1] !== "rest").reduce((s, p) => s + (p[1] as number), 0);
        parts = spec.map(([mode, amt, ref, ref2]) => ({ mode, amount: amt === "rest" ? round2(due(c) - fixed) : amt, ref: ref || "", ref2: ref2 || "" }));
      }
      return A.payAll(w, c, via, fx, detail || "", parts || undefined);
    }
    case "cancelBill": return A.cancelBill(w, c, fx);
    case "sendLink": return A.sendLink(w, c, fx);
    case "resendLink": return A.resendLink(w, c, fx);
    case "simPaid": return A.simPaid(w, c, fx);
    case "simStale": return A.simStale(w, c);
    case "simApproval": return A.simApproval(w, c, fx);
    case "simOrders": return A.simOrders(w, c, fx);
    case "checkDoctor": return A.checkDoctor(w, c, fx);
    case "checkOrders": return A.checkOrders(w, c, fx);
    case "checkApproval": return A.checkApproval(w, c, fx);
  }
  throw new Error(`unknown op ${op}`);
}

function snap(w: World, c: Visit) {
  const s = nextStep(w, c), p = w.patients[c.mrn]!, stories = visitStories(w, c);
  return {
    step: s.key, q: norm(text(s.q)), sub: norm(text(s.sub)), amt: s.amt ?? null,
    buttons: s.actions.map((x) => text(x.label)),
    stories, active: activeStory(w, c), stages: Object.fromEntries(stories.map((id) => [id, storyStage(w, c, id)])),
    due: due(c), dedUsed: c.dedUsed, link: c.link ? c.link.ageMin : null, waitAll: !!c.prefs.waitAll,
    bill: c.bill ? { scope: c.bill.scope, codes: c.bill.codes, patient: c.bill.patient, company: c.bill.company, deductible: c.bill.deductible, cashOnly: !!c.bill.cashOnly } : null,
    lines: [c.consult, ...c.orders].map((l) => ({ code: l.code, ins: l.ins, price: l.price, paid: !!l.paid, via: l.via || null, invoiceId: l.invoiceId || null,
      urgentCash: !!l.urgentCash, approvalPending: !!l.approvalPending })),
    invoices: c.invoices.map((i) => ({ id: i.id, scope: i.scope, patient: i.patient, company: i.company, deductible: i.deductible, paid: i.paid,
      via: i.via, viaDetail: norm(i.viaDetail), payments: i.payments || null, payer: i.payer, branch: i.branch || null, cashOnly: !!i.cashOnly,
      billType: i.billType || null, rows: i.rows.map((r) => r.code) })),
    history: c.history.map((h) => ({ ic: h.ic || "", tx: norm(h.tx), sub: norm(h.sub), type: h.type || "", by: h.by || "",
      invoiceId: h.invoiceId || null, amount: h.amount ?? null, mode: h.mode || null })),
    wallet: { ...p.wallet.advance }, credit: creditTotal(w, c.mrn),
    ledger: (p.ledger || []).map((e) => ({ type: e.type, amount: e.amount, note: norm(e.note), invoiceId: e.invoiceId || null, visitId: e.visitId ?? null, docId: e.docId || null })),
    visit: { type: c.visitType, clinic: c.clinic, doctor: c.doctor, slot: c.slot || null, consult: { name: c.consult.name, code: c.consult.code, price: c.consult.price } },
    payerId: c.payerId, policy: c.policy ? norm(Object.values(c.policy).join("|")) : null, payers: p.payers.map((x) => x.id),
    payerStory: c.payerStory ? c.payerStory.stage : null,
    done: Object.fromEntries(Object.entries(c.storyDone || {}).map(([k, v]) => [k, `${norm(v.title)} | ${norm(v.sub)}${v.cash ? " | cash" : ""}`])),
    settled: visitsOf(w, c.mrn).flatMap((v) => v.invoices.filter((i) => i.settled).map((i) => `${i.id}:${i.settledVia}`)),
    appr: [c.consult, ...c.orders].map((l) => l.appr || null),
    docs: (p.walletDocs || []).map((d) => `${d.id}:${d.wtype}:${d.amount}:${d.visitId}:${d.invoiceId || ""}:${norm(d.note)}`),
  };
}

describe("scripted flows match v3 step by step", () => {
  setClock(new Date(golden.generatedAt));
  const w = createWorld();
  let seed = 42;
  setRandom(() => (seed = (seed * 16807) % 2147483647) / 2147483647);
  /* one world for every flow, in order, exactly as the extractor ran them */
  const results = golden.flows.map((f) => ({ f, got: f.ops.map((o) => { runOp(w, o as Op); return snap(w, w.cases.find((x) => x.id === o[1])!); }) }));
  setRandom(null);
  for (const { f, got } of results)
    it(f.name, () => {
      f.snaps.forEach((want, i) => expect(got[i], `${f.name} · op ${i} ${JSON.stringify(f.ops[i])}`).toEqual(want));
    });
});
