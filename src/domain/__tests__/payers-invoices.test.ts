import { describe, expect, it } from "vitest";
import { createWorld } from "../../data/world";
import { setClock } from "../clock";
import { invFilterSummary, pairInvoices, patientInvoiceSummary, defaultInvFilters } from "../invoices";
import * as P from "../payers";
import type { PayerStory } from "../types";
import { freeSlots } from "../visits";

/* checkpoint 1c: the payer story's choices, the walk-in's slots, the paired invoice list (v3 lines 2278–2462,
   3988–4004, 4619, 4697) */
describe("payer story", () => {
  const w = createWorld();
  const story = (mrn: string): PayerStory => ({ stage: 2, at: "12:00", results: P.eligibilityOf(mrn) });

  it("offers what NPHIES returned plus cash, with the plan on file or the one NPHIES sent", () => {
    const o = P.payerOptions(w, "7000667", story("7000667"));
    expect(o.all.map((x) => [x.id, x.status || x.kind])).toEqual([["BUPA-GOLD", "Eligible"], ["TAW-SILVER", "Not eligible"], ["CASH", "Cash"]]);
    expect(o.ins[0]!.plan!.name).toBe("BUPA GOLD");
    expect(P.payerOptions(w, "1063301", story("1063301")).ins[0]!.plan!.name).toBe("GIG CLASS C");
  });
  it("cash is decided at once; an insurer goes to its policy details, filled from NPHIES", () => {
    const ps = story("7000667");
    const [bupa, , cash] = P.payerOptions(w, "7000667", ps).all;
    expect(P.choosePayer(ps, bupa!)).toBe(false);
    expect([ps.stage, ps.form!.policyNo, ps.form!.fromNphies, P.payerReady(ps)]).toEqual([3, "80737", true, true]);
    expect(P.choosePayer(ps, cash!)).toBe(true);
    expect([ps.stage, ps.form]).toEqual([4, null]);
  });
  it("manual entry searches the directory, and changing the group means picking again", () => {
    const ps = story("7000667");
    P.startManual(ps);
    expect(P.payerMatches(ps)).toBeNull();
    P.editPayerField(ps, "group", "charity");
    expect(P.payerMatches(ps)!.map((x) => x.id)).toEqual(["CH-HABIB"]);
    P.pickDirectory(ps, "CH-HABIB");
    expect([ps.choice!.kind, ps.form!.contract, P.payerIsInternal(ps.choice), P.payerReady(ps)]).toEqual(["Charity", "Charity programme 2026", true, false]);
    P.editPayerField(ps, "policyNo", "CH-1");
    expect(P.payerReady(ps)).toBe(true);
    P.editPayerField(ps, "group", "zakat");
    expect([ps.choice!.id, ps.form!.type, P.payerReady(ps)]).toEqual([null, "", false]);
    /* an insurer NPHIES already listed as eligible is not offered again */
    P.editPayerField(ps, "contract", ""); P.editPayerField(ps, "policy", ""); P.editPayerField(ps, "group", "bupa");
    expect(P.payerMatches(ps)!.map((x) => x.id)).toEqual(["BUPA-SIL"]);
  });
  it("the table of benefits follows the plan", () => {
    const gold = P.tobRows(w.patients["7000667"]!.payers[0]!.plan, "BUPA · GOLD");
    expect(gold).toHaveLength(8);
    expect(gold[0]![2]).toEqual({ k: "tob.dedMax", p: { pct: 20, cap: "SAR 200.00" } });
    expect(gold[5]![1]).toEqual({ k: "tob.covered", p: undefined });
    const charity = P.tobRows({ name: "Charity — full cover", deductiblePct: 0, discountPct: 0, visitCap: 0, annualLeft: 99999, internal: true });
    expect(charity.map((r) => r[1]!.k)).toEqual(["tob.coveredFull", "tob.coveredFull", "tob.notCovered"]);
  });
  it("reception prices orders at the cash price with VAT", () => {
    expect(P.catPrice({ code: "LAB-CBC", name: "", kind: "order", price: 90, noDoctor: true })).toBe(103.5);
    expect(P.cartItems({ sel: { "LAB-CBC": true, "PKG-EXEC": true } }).map((x) => x.code)).toEqual(["PKG-EXEC", "LAB-CBC"]);
  });
});

describe("free slots", () => {
  it("run every 15 minutes from now until the clinic closes, skipping the doctor's booked ones", () => {
    setClock(new Date("2026-10-13T12:00:00"));
    const w = createWorld();
    const s = freeSlots(w, "LINA FAROUK");
    expect(s[0]! >= "12:15").toBe(true);
    expect(s.every((x) => x < "20:00" && /:(00|15|30|45)$/.test(x))).toBe(true);
    expect(s.length).toBeGreaterThan(10);
    expect(s).toEqual(freeSlots(w, "LINA FAROUK"));
    setClock(null);
  });
});

describe("invoices", () => {
  it("pairs a patient's documents by visit group, wallet documents last", () => {
    const w = createWorld();
    const rows = pairInvoices(w, patientInvoiceSummary(w, "7000667").list);
    const seps = rows.filter((r) => r.sep).map((r) => r.sep!.title);
    expect(seps[0]).toMatch(/^V100002/);
    expect(rows.filter((r) => !r.sep)).toHaveLength(7);
  });
  it("summarises the filters it loaded", () => {
    expect(invFilterSummary({ f: { ...defaultInvFilters(), preset: "any", mode: "Credit" }, q: "qahtani" }))
      .toEqual(["“qahtani”", { k: "invoices.preset.any" }, "Credit"]);
  });
});
