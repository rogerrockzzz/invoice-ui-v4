import { describe, expect, it } from "vitest";
import { createWorld } from "../../data/world";
import {
  addNote, addPart, drawerConfirm, drawerView, editPart, newDrawer, payActive, payParts, pickMode, removePart, setPartAmount,
  setTendered, usualNotes,
} from "../drawer";

/* The payment pop-up's arithmetic (v3 lines 5493–5523, 5698–5798), worked through by hand. */
const w = createWorld();
const c1 = w.cases.find((x) => x.id === 1)!; /* WADHA — no advance */
const c2 = w.cases.find((x) => x.id === 2)!; /* MOHAMMED — SAR 500 open advance */

describe("cash", () => {
  it("starts on the usual notes for what is due, and hands back the change", () => {
    const d = newDrawer(1, "7000203", 46);
    expect(d.notes).toEqual({ 10: 4, 5: 1, 1: 1 });
    expect(drawerView(w, c1, d).change).toBe(0);
    setTendered(d, "100");
    const v = drawerView(w, c1, d);
    expect([v.tendered, v.activeAmt, v.change, v.canConfirm]).toEqual([100, 46, 54, true]);
    expect(drawerConfirm(d)).toEqual({ mode: "Cash", detail: "tendered SAR 100.00 · change SAR 54.00", parts: [{ mode: "Cash", amount: 46, ref: "", ref2: "" }] });
  });
  it("counts the notes handed over into the detail", () => {
    const d = newDrawer(1, "7000203", 46);
    d.notes = {}; addNote(d, 100);
    expect(drawerConfirm(d).detail).toBe("tendered SAR 100.00 (1×SAR 100) · change SAR 54.00");
    usualNotes(d);
    expect(drawerConfirm(d).detail).toBe("tendered SAR 46.00 (4×SAR 10 + 1×SAR 5 + 1×SAR 1)");
  });
  it("short cash leaves the rest to allocate and blocks the confirm", () => {
    const d = newDrawer(1, "7000203", 46);
    setTendered(d, "20");
    const v = drawerView(w, c1, d);
    expect([v.activeAmt, v.unallocated, v.canConfirm]).toEqual([20, 26, false]);
  });
});

describe("modes and splits", () => {
  it("keeps the rarer modes and empty advance pots behind 'more'", () => {
    const v1 = drawerView(w, c1, newDrawer(1, "7000203", 46));
    expect(v1.shown.map((m) => m.id)).toEqual(["Span", "Visa", "Master card", "Cash", "Credit"]);
    expect(v1.rest.map((m) => m.id)).toEqual(["MADA", "Amex", "OPEN", "DOCTOR", "CLINIC", "INTER_COMPANY_REFERRAL_PAYMENT", "Cash From Finance"]);
    expect(drawerView(w, c2, newDrawer(2, "7000667", 273.69)).shown.map((m) => m.id)).toContain("OPEN");
  });
  it("refuses an empty advance pot", () => {
    const d = newDrawer(1, "7000203", 46);
    expect(pickMode(w, c1, d, "OPEN")?.title.k).toBe("toast.noAdvance");
    expect(d.mode).toBe("Cash");
  });
  it("Span 100 + OPEN advance for the rest — the commonest partner is preselected", () => {
    const d = newDrawer(2, "7000667", 273.69);
    pickMode(w, c2, d, "Span");
    expect(setPartAmount(d, 100)).toBeNull();
    expect(drawerView(w, c2, d).unallocated).toBe(173.69);
    expect(addPart(w, c2, d).title).toEqual({ k: "toast.partAdded", p: { mode: "Span", amount: "SAR 100.00" } });
    expect(d.mode).toBe("Span");
    pickMode(w, c2, d, "OPEN");
    const v = drawerView(w, c2, d);
    expect([v.canConfirm, v.shortAdv, v.walletAfter, v.goLabel]).toEqual([true, false, 326.31, { k: "drawer.go.parts", p: { count: 2 } }]);
    expect(drawerConfirm(d)).toEqual({
      mode: "Span + OPEN", detail: "Span SAR 100.00 + OPEN SAR 173.69",
      parts: [{ mode: "Span", amount: 100, ref: "", ref2: "", tendered: null, notes: null, manual: false }, { mode: "OPEN", amount: 173.69, ref: "", ref2: "" }],
    });
  });
  it("an advance part larger than the pot is short", () => {
    const d = newDrawer(2, "7000667", 600);
    pickMode(w, c2, d, "OPEN");
    const v = drawerView(w, c2, d);
    expect([v.shortAdv, v.canConfirm]).toEqual([true, false]);
    expect(v.short).toEqual([{ cat: "Open", want: 600, has: 500 }]);
  });
  it("a taken part can be pulled back to edit, or removed", () => {
    const d = newDrawer(2, "7000667", 273.69);
    pickMode(w, c2, d, "Visa"); setPartAmount(d, 50); d.ref = "884120"; addPart(w, c2, d);
    editPart(d, 0);
    expect([d.mode, d.partAmt, d.ref, d.editing, d.parts.length]).toEqual(["Visa", 50, "884120", "Visa", 0]);
    addPart(w, c2, d); removePart(d, 0);
    expect([d.mode, d.parts.length, payActive(d)!.amount]).toEqual(["Visa", 0, 273.69]);
  });
  it("too much on a part is capped at what is left", () => {
    const d = newDrawer(1, "7000203", 46);
    pickMode(w, c1, d, "Span");
    expect(setPartAmount(d, 80)?.title.k).toBe("toast.onlyLeft");
    expect(payParts(d)).toEqual([{ mode: "Span", amount: 46, ref: "", ref2: "" }]);
  });
  it("credit labels the total and the button", () => {
    const d = newDrawer(1, "7000203", 46);
    pickMode(w, c1, d, "Credit");
    const v = drawerView(w, c1, d);
    expect([v.totalLabel, v.goLabel]).toEqual(["toCredit", { k: "drawer.go.credit" }]);
    pickMode(w, c1, d, "Span"); setPartAmount(d, 20); addPart(w, c1, d); pickMode(w, c1, d, "Credit");
    expect(drawerView(w, c1, d).totalLabel).toBe("toCollectAndCredit");
  });
});

describe("credit settlement and advance refund are one part, no split (v3 line 5528)", () => {
  it("settling credit offers every mode but Credit, and takes the whole amount", () => {
    const d = newDrawer(2, "7000667", 300, { credit: { ids: ["INV-731044", "INV-742118"] } });
    pickMode(w, c2, d, "Span"); d.ref = "884120"; d.ref2 = "4417";
    const v = drawerView(w, c2, d);
    expect(v.shown.map((m) => m.id)).not.toContain("Credit");
    expect(v.rest.map((m) => m.id)).not.toContain("Credit");
    expect([v.simple, v.unallocated, v.canConfirm, v.totalLabel, v.head]).toEqual([true, 0, true, "toCollect", "credit"]);
    expect(drawerConfirm(d)).toEqual({ mode: "Span", detail: "4417 · 884120", parts: [{ mode: "Span", amount: 300, ref: "884120", ref2: "4417" }] });
  });
  it("an advance pot that cannot cover the settlement blocks it", () => {
    const d = newDrawer(2, "7000667", 600, { credit: { ids: [] } });
    pickMode(w, c2, d, "OPEN");
    expect(drawerView(w, c2, d).canConfirm).toBe(false);
  });
  it("an advance refund goes back by a refund mode, never to the wallet", () => {
    const d = newDrawer(2, "7000667", 100, { advRefund: { cat: "Open", reason: "travelling" } });
    const v = drawerView(w, c2, d);
    expect(v.refundModes).toEqual(["Cash", "Span", "Visa", "Master card"]);
    expect([v.back, v.canConfirm, v.totalLabel, v.goLabel, v.advParts.length]).toEqual([true, true, "toRefund", { k: "drawer.go.refund", p: { mode: "cash" } }, 0]);
    expect(drawerConfirm(d)).toEqual({ mode: "Cash", detail: "", parts: [{ mode: "Cash", amount: 100, ref: "", ref2: "" }] });
  });
});
