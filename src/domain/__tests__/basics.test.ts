import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fmt, round2 } from "../money";
import { rich } from "../../ui/Rich";
import { useUi } from "../../store/ui";
import { useWorld } from "../../store/world";

describe("money", () => {
  it("always formats with Western digits and two decimals", () => {
    expect(fmt(273.69)).toBe("SAR 273.69");
    expect(fmt(1234.5)).toBe("SAR 1,234.50");
    expect(fmt(0)).toBe("SAR 0.00");
    expect(fmt(undefined)).toBe("SAR 0.00");
  });
  it("rounds exactly like v3's +x.toFixed(2)", () => {
    for (const x of [1.005, 2.675, 142.025, 105.455, 0.1 + 0.2]) expect(round2(x)).toBe(+x.toFixed(2));
  });
});

describe("rich text", () => {
  const html = (s: string) => renderToStaticMarkup(createElement(Fragment, null, ...rich(s, (id) => createElement("a", { href: `#${id}` }, id))));
  it("renders <b> and <inv> and nothing else", () => {
    expect(html("Collected <b>SAR 5.00</b> on <inv>INV-1</inv>.")).toBe('Collected <strong class="font-semibold">SAR 5.00</strong> on <a href="#INV-1">INV-1</a>.');
  });
  it("never injects other markup", () => {
    expect(html('<img src=x onerror="alert(1)"> <b>ok</b>')).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; <strong class="font-semibold">ok</strong>');
  });
});

describe("navigation (v3 openPatient / closeTab / goHome)", () => {
  it("keeps several patients open and falls back to the last tab when one closes", () => {
    const ui = useUi.getState();
    ui.reset();
    ui.openPatient("7000667");
    ui.openPatient("7000203");
    ui.openVisit(2, "7000667");
    let s = useUi.getState();
    expect(s.tabs).toEqual(["7000667", "7000203"]);
    expect([s.screen, s.activeMrn, s.caseId]).toEqual(["visit", "7000667", 2]);
    s.closeTab("7000667");
    s = useUi.getState();
    expect([s.screen, s.activeMrn, s.caseId, s.tabs]).toEqual(["patient", "7000203", null, ["7000203"]]);
    s.closeTab("7000203");
    s = useUi.getState();
    expect([s.screen, s.activeMrn, s.tabs]).toEqual(["home", null, []]);
  });
  it("resets the world to the v3 seed", () => {
    useWorld.getState().setBranch("Qassim Hospital");
    useWorld.getState().reset();
    expect(useWorld.getState().settings.branch).toBe("AL Hamra Hospital");
    expect(useWorld.getState().patients["7000667"]!.walletDocs!.map((d) => d.id)).toEqual(["CRED-400101", "ADV-400102", "CRED-400103"]);
  });
});
