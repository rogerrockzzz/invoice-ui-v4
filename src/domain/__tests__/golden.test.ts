import { beforeAll, describe, expect, it } from "vitest";
import golden from "../__golden__/v3.json";
import { createWorld } from "../../data/world";
import i18n from "../../i18n";
import { resolveMsg } from "../../i18n/msg";
import { calcLine, dedPool, priceLines } from "../pricing";
import { approvedOrders, collected, creditOf, creditTotal, refundable, refundState } from "../lines";
import { nextStep, pendingSummary, pendingVisits } from "../steps";
import { mainStory, STORIES, storyBadge, storyLock, storyStage, visitStories, type StoryId } from "../stories";
import { ledgerRows } from "../ledger";
import { suggestNotes } from "../cash";
import { visitsOf } from "../lookup";
import { activePayerOf, parentVisit, rootVisit, visitNo } from "../visits";
import { invDate, invMode, invPayerType, invStatus, invType, queryInvoices, type InvFilters } from "../invoices";
import { searchPayers } from "../payers";
import { setClock } from "../clock";
import type { Line, Plan, World } from "../types";

/* Every figure and decision below is compared with what journey-opd-v3.html itself returns
   (src/domain/__golden__/v3.json, regenerated with `npm run golden`). */
let w: World;
const t = i18n.t.bind(i18n);
const text = (m: Parameters<typeof resolveMsg>[1]) => resolveMsg(t, m);
const strip = (x: ReturnType<typeof priceLines>) => ({
  patient: x.patient, company: x.company, deductible: x.deductible, rows: x.rows.map((r) => ({ code: r.line.code, calc: r.calc })),
});

beforeAll(() => {
  setClock(new Date(golden.generatedAt)); /* "Today", booked visits and invoice dates as when the goldens were taken */
  w = createWorld();
});

describe("calcLine", () => {
  it("matches v3 for every status × plan × deductible left × price", () => {
    const fresh = createWorld();
    const plans: Record<string, Plan | null> = {
      none: null,
      bupaGold: fresh.patients["7000667"]!.payers[0]!.plan,
      ncciA: fresh.patients["7000203"]!.payers[0]!.plan,
      tawSilver: fresh.patients["7100482"]!.payers[0]!.plan,
    };
    for (const g of golden.calc) {
      const line = { price: g.price, ins: g.ins as Line["ins"], selfPay: (g as { selfPay?: boolean }).selfPay };
      expect(calcLine(line, g.dLeft, plans[g.plan]), JSON.stringify(g)).toEqual(g.out);
    }
  });
});

describe("visits", () => {
  for (const g of golden.visits) {
    describe(`visit ${g.id} (${g.visitNo})`, () => {
      const c = () => w.cases.find((x) => x.id === g.id)!;
      it("prices like v3", () => {
        expect(visitNo(c())).toBe(g.visitNo);
        expect(dedPool(w, c())).toEqual(g.dedPool);
        expect(strip(priceLines(w, c(), [c().consult]))).toEqual(g.priceConsult);
        expect(strip(priceLines(w, c(), approvedOrders(c())))).toEqual(g.priceApproved);
        expect(strip(priceLines(w, c(), c().orders.map((o) => ({ ...o, ins: "approved" as const }))))).toEqual(g.priceAllApproved);
        expect(collected(c())).toBe(g.collected);
      });
      it("takes the same next step, word for word", () => {
        const s = nextStep(w, c());
        expect(s.key).toBe(g.step.key);
        expect(s.tone).toBe(g.step.tone);
        expect(text(s.tag)).toBe(g.step.tag);
        expect(text(s.q)).toBe(g.step.q);
        expect(text(s.sub)).toBe(g.step.sub);
        expect(s.amt ?? null).toBe(g.step.amt);
        expect(s.amtLabel ? text(s.amtLabel) : null).toBe(g.step.amtLabel);
        expect((s.amts || []).map((a) => ({ v: a.v, label: text(a.label) }))).toEqual(g.step.amts);
        expect(s.ext ? { title: text(s.ext.title), codes: s.ext.lines.map((l) => l.code), selectable: !!s.ext.selectable, note: s.ext.note ? text(s.ext.note) : null } : null).toEqual(g.step.ext);
        expect(s.actions.map((a) => text(a.label))).toEqual(g.step.buttons);
        expect(!!s.back).toBe(g.step.back);
      });
      it("shows the same stories at the same stages", () => {
        expect(visitStories(w, c())).toEqual(g.stories);
        expect(mainStory(w, c())).toBe(g.main);
        for (const [id, pos] of Object.entries(g.stages)) expect(storyStage(w, c(), id as StoryId), id).toEqual(pos);
        const ps = pendingSummary(w, c());
        expect({ kind: ps.kind, owed: ps.owed }).toEqual(g.pending);
      });
      it("links to the same parent and root visit", () => {
        expect(parentVisit(w, c())?.id ?? null).toBe(g.parent);
        expect(rootVisit(w, c()).id).toBe(g.root);
      });
      it("labels and locks its stories the same way", () => {
        for (const [id, badge] of Object.entries(g.badges)) expect(text(storyBadge(w, c(), id as StoryId)), id).toBe(badge);
        for (const id of Object.keys(STORIES)) expect(text(storyLock(c(), id as StoryId)), id).toBe(g.locks[id as keyof typeof g.locks] || "");
      });
      it("classifies its invoices the same way", () => {
        expect(c().invoices.map((inv) => ({
          id: inv.id, refundable: refundable(w, inv), state: refundState(inv), type: invType(inv), status: invStatus(inv),
          mode: invMode(inv), payerType: invPayerType(w, c(), inv), date: invDate(c(), inv), credit: creditOf(inv),
        }))).toEqual(g.invoices);
      });
    });
  }
});

describe("patients", () => {
  for (const g of golden.patients) {
    it(`${g.mrn}: wallet, credit, visit order, pending and active payer`, () => {
      expect(creditTotal(w, g.mrn)).toBe(g.creditTotal);
      const lr = (e: ReturnType<typeof ledgerRows>[number]) => ({
        type: e.type, amount: e.amount, balance: e.balance, inflow: e.inflow, docId: e.docId || null, invoiceId: e.invoiceId || null,
      });
      expect(ledgerRows(w, g.mrn, "ADV").map(lr)).toEqual(g.ledgerADV);
      expect(ledgerRows(w, g.mrn, "CREDIT").map(lr)).toEqual(g.ledgerCREDIT);
      expect((w.patients[g.mrn]!.walletDocs || []).map((d) => ({ id: d.id, wtype: d.wtype, amount: d.amount, visitId: d.visitId, invoiceId: d.invoiceId }))).toEqual(g.walletDocs);
      expect(visitsOf(w, g.mrn).map((c) => c.id)).toEqual(g.visitOrder);
      const pv = pendingVisits(w, g.mrn);
      expect({ today: pv.today.map((x) => x.c.id), upcoming: pv.upcoming.map((x) => x.c.id), earlier: pv.earlier.map((x) => x.c.id) }).toEqual(g.pending);
      const ap = activePayerOf(w, w.patients[g.mrn]!);
      const from = !ap.from ? "" : ap.from.kind === "profile" ? t("patient.fromProfile")
        : t(ap.from.kind === "open" ? "patient.fromOpen" : "patient.fromLast", { date: ap.from.date, at: ap.from.at });
      expect({ id: ap.payer.id, from }).toEqual(g.activePayer);
    });
  }
});

describe("invoice queries and payer search", () => {
  it("retrieves the same invoices for each search and filter", () => {
    for (const g of golden.queries) expect(queryInvoices(w, g.f as InvFilters, g.q).map((r) => r.inv.id), JSON.stringify(g)).toEqual(g.ids);
  });
  it("finds the same payers in the directory", () => {
    for (const g of golden.payerSearch) expect(searchPayers(g.f).map((x) => x.id), JSON.stringify(g.f)).toEqual(g.ids);
  });
});

describe("suggestNotes", () => {
  it("hands over the same notes as v3", () => {
    for (const g of golden.notes) expect(suggestNotes(g.amount)).toEqual(Object.fromEntries(Object.entries(g.out).map(([k, v]) => [Number(k), v])));
  });
});
