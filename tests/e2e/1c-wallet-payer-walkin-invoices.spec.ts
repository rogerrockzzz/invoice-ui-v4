import { expect, test, type Page } from "@playwright/test";

/* Checkpoint 1c — the wallet (statements, add / refund advance, credit settlement), the payer story, the walk-in
   and the Invoices screen. Comments quote the matching sections of the v3 smoke suite
   (docs/Devin Invoice UI/_smoke_journey3.html). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00"));
  await page.goto("/");
});

type Vida = { __vida: { ui: { getState(): { openVisit(id: number, mrn: string): void; openPatient(mrn: string): void; setTheme(t: string): void } }; world: { getState(): unknown } } };
const openVisit = (page: Page, id: number, mrn: string) =>
  page.evaluate(([i, m]) => (globalThis as unknown as Vida).__vida.ui.getState().openVisit(i as number, m as string), [id, mrn]);
const openPatient = (page: Page, mrn: string) => page.evaluate((m) => (globalThis as unknown as Vida).__vida.ui.getState().openPatient(m), mrn);
const world = <T,>(page: Page, fn: string, arg?: unknown) =>
  page.evaluate(([f, a]) => new Function("w", "a", `return (${f})(w, a)`)((globalThis as unknown as Vida).__vida.world.getState(), a), [fn, arg]) as Promise<T>;
const wallet = (page: Page) => page.getByTestId("wallet-section");
const card = (page: Page) => page.getByTestId("step-card");
const drawer = (page: Page, head = "Payment") => page.getByRole("dialog", { name: new RegExp(`^${head} ·`) });
const stepNow = (root: ReturnType<Page["getByTestId"]>) => root.locator('li[aria-current="step"]');
const pick = async (page: Page, label: string, option: string) => {
  await page.getByRole("button", { name: new RegExp(` ${label}$`) }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
const amount = async (page: Page, testId: string, v: string) => {
  const f = page.getByTestId(testId);
  await f.fill(v);
  await f.press("Tab");
};

test("advance and credit have separate statements, each ending at the real figure", async ({ page }) => {
  await openPatient(page, "7000667");
  await page.getByTestId("wallet-chip").click();
  /* the wallet opens as a section showing advance by pot and outstanding credit */
  await expect(wallet(page).getByTestId("wallet-pots")).toContainText("Open advance");
  await expect(wallet(page).getByRole("tab", { name: /Advance/ })).toContainText("SAR 500.00");
  await expect(wallet(page).getByRole("tab", { name: /Credit/ })).toContainText("SAR 300.00");
  await wallet(page).getByRole("button", { name: "Advance statement" }).click();
  /* each has a single running balance of its own, ending at the real figure */
  await expect(page.getByTestId("ledger-left-ADV")).toHaveText("SAR 500.00");
  /* neither table carries the other account's movements */
  const adv = page.getByTestId("ledger-ADV");
  await expect(adv.locator("[data-type]")).toHaveCount(1);
  await expect(adv).not.toContainText("Put on credit");
  await wallet(page).getByRole("tab", { name: /Credit/ }).click();
  await expect(page.getByTestId("ledger-ADV")).toHaveCount(0);
  await wallet(page).getByRole("button", { name: "Credit statement" }).click();
  await expect(page.getByTestId("ledger-left-CREDIT")).toHaveText("SAR 300.00");
  const cr = page.getByTestId("ledger-CREDIT");
  await expect(cr.locator("[data-type]")).toHaveCount(2);
  await expect(cr).not.toContainText("Advance received");
  await expect(cr.locator("[data-type]").first()).toContainText("SAR 300.00");
  /* invoice links still work from the credit statement */
  await cr.getByRole("link", { name: "INV-742118" }).click();
  await expect(page.getByTestId("inv-id")).toHaveText("INV-742118");
  await page.getByRole("button", { name: "Close" }).last().click();
  /* a wallet document opens as its own document */
  await cr.getByRole("link", { name: /^CRED-/ }).first().click();
  await expect(page.getByRole("dialog")).toContainText("CREDIT NOTE");
});

test("add advance through the wallet story, then spend it — the invoice number comes through", async ({ page }) => {
  await openVisit(page, 2, "7000667");
  await page.getByTestId("wallet-chip").click();
  await wallet(page).getByRole("button", { name: "Add advance" }).click();
  await expect(stepNow(wallet(page))).toContainText("Pot & amount");
  await wallet(page).getByRole("radio", { name: /Doctor/ }).click();
  await amount(page, "wallet-amount", "250");
  /* switching tabs while a flow is open is refused */
  await wallet(page).getByRole("tab", { name: /Credit/ }).click();
  await expect(page.getByText("Finish this first")).toBeVisible();
  await wallet(page).getByRole("button", { name: "Take payment · SAR 250.00" }).click();
  await expect(stepNow(wallet(page))).toContainText("Payment");
  const adv = page.getByRole("dialog", { name: /^Add advance ·/ });
  await expect(adv.getByRole("radio", { name: /Doctor/ })).toBeChecked();
  await adv.getByRole("button", { name: "Add advance" }).click();
  await expect(wallet(page).getByTestId("wallet-done")).toContainText("Advance added — SAR 250.00");
  await expect(page.getByTestId("wallet-advance")).toHaveText("SAR 750.00");
  const led = await world<{ type: string; cat: string; docId: string; visitId: number }>(page, "(w)=>w.patients['7000667'].ledger[0]");
  expect([led.type, led.cat, led.visitId]).toEqual(["ADV_IN", "Doctor", 2]);
  expect(led.docId).toMatch(/^ADV-/);
  await expect(page.getByTestId("event").first()).toContainText("Advance added — SAR 250.00");
  await wallet(page).getByRole("button", { name: "Done" }).click();

  /* now spend it on a charge, and check the invoice number comes through */
  await page.getByRole("button", { name: "Bill the 3 approved now" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  const d = drawer(page);
  await expect(d.getByRole("radio", { name: /^DOCTOR/ })).toContainText("SAR 250.00 available");
  await d.getByRole("radio", { name: "Span", exact: true }).click();
  await amount(page, "part-amount", "23.69");
  await d.getByRole("button", { name: /Add this SAR 23.69/ }).click();
  await d.getByRole("radio", { name: /^DOCTOR/ }).click();
  await d.getByRole("button", { name: "Confirm 2 payments" }).click();
  await expect(d).toHaveCount(0);
  const spent = await world<{ type: string; invoiceId: string; note: string; inv: string }>(page,
    "(w)=>({ ...w.patients['7000667'].ledger[0], inv: w.cases.find(c=>c.id===2).invoices[0].id })");
  expect(spent.type).toBe("ADV_USED");
  expect(spent.invoiceId).toBe(spent.inv);
  expect(spent.note).toBe("Applied to orders · SAR 250.00 doctor");
  await expect(page.getByTestId("wallet-advance")).toHaveText("SAR 500.00");
});

test("refund advance: pot, amount and reason here, the refund mode in the slide-in", async ({ page }) => {
  await openPatient(page, "7000667");
  await page.getByTestId("wallet-chip").click();
  await wallet(page).getByRole("button", { name: "Refund advance" }).click();
  await expect(wallet(page).getByRole("radio", { name: /Open/ })).toBeChecked();
  await expect(wallet(page).getByRole("radio", { name: /Doctor/ })).toBeDisabled();
  const go = wallet(page).getByRole("button", { name: /^Yes, refund/ });
  await amount(page, "wallet-amount", "100");
  await expect(go).toBeDisabled(); /* a reason is required */
  await wallet(page).getByRole("textbox", { name: /Reason/ }).fill("patient travelling");
  await expect(go).toBeEnabled();
  await go.click();
  const d = drawer(page, "Refund advance");
  await expect(d.getByTestId("adv-refund-box")).toContainText("Open advance");
  await expect(d.getByRole("radio", { name: "Advance wallet" })).toHaveCount(0);
  await expect(d.getByTestId("drawer-total")).toContainText("To refund");
  await d.getByRole("button", { name: "Refund by cash" }).click();
  await expect(wallet(page).getByTestId("wallet-done")).toContainText("Advance refunded — SAR 100.00");
  await expect(page.getByTestId("wallet-advance")).toHaveText("SAR 400.00");
  const led = await world<{ type: string; amount: number; mode: string; docId: string; note: string }>(page, "(w)=>w.patients['7000667'].ledger[0]");
  expect([led.type, led.amount, led.mode, led.note]).toEqual(["ADV_REFUND", 100, "Cash", "Open advance refunded · patient travelling"]);
  expect(led.docId).toMatch(/^RADV-/);
});

test("settle both credit invoices by Span from visit 2 — the entry is on this visit", async ({ page }) => {
  await openVisit(page, 2, "7000667");
  await page.getByRole("radio", { name: /Credit settlement/ }).click();
  await expect(page.getByTestId("credit-row")).toHaveCount(2);
  await expect(card(page).getByTestId("step-amt")).toContainText("SAR 300.00");
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  const d = drawer(page, "Credit settlement");
  await expect(stepNow(card(page))).toContainText("Payment");
  await expect(d.getByRole("radio", { name: /^Credit/ })).toHaveCount(0);
  await d.getByRole("radio", { name: "Span", exact: true }).click();
  await d.getByRole("button", { name: "Confirm span payment" }).click();
  await expect(page.getByTestId("wallet-credit")).toHaveText("SAR 0.00");
  await expect(card(page)).toContainText("Credit settled — SAR 300.00");
  const h = await world<{ type: string; invoiceIds: string[] }>(page, "(w)=>w.cases.find(c=>c.id===2).history[0]");
  expect(h.type).toBe("CREDIT");
  expect(h.invoiceIds.sort()).toEqual(["INV-731044", "INV-742118"]);
  /* the settled invoices say so */
  await page.getByTestId("event").first().getByRole("link", { name: "INV-731044" }).click();
  await expect(page.getByTestId("inv-foot")).toContainText("Settled — Span");
});

test("settling from the wallet writes to the visit you are on, not whichever visit raised the credit", async ({ page }) => {
  await openVisit(page, 20, "7000667");
  const before = await world<number>(page, "(w)=>w.cases.find(c=>c.id===20).history.length");
  await page.getByTestId("wallet-chip").click();
  await wallet(page).getByRole("tab", { name: /Credit/ }).click();
  await wallet(page).getByRole("button", { name: "Settle credit · SAR 300.00" }).click();
  await expect(wallet(page).getByRole("checkbox")).toHaveCount(2);
  await wallet(page).getByRole("button", { name: "Take payment at the desk" }).click();
  await drawer(page, "Credit settlement").getByRole("button", { name: "Confirm cash payment" }).click();
  await expect(wallet(page).getByTestId("wallet-done")).toContainText("Credit settled — SAR 300.00");
  const h = await world<{ n: number; tx: string; ids: string[] }>(page, "(w)=>{const c=w.cases.find(c=>c.id===20);return {n:c.history.length,tx:c.history[0].tx,ids:c.history[0].invoiceIds}}");
  expect(h.n).toBe(before + 1);
  expect(h.tx).toBe("<b>Credit settled</b> — SAR 300.00");
  expect(h.ids).toHaveLength(2);
});

test("the payer is a story: NPHIES eligibility first — cash, an insurer, an internal charity", async ({ page }) => {
  await openVisit(page, 30, "7000667");
  /* no button on the step — the payer chip in the header is the way in */
  await expect(page.getByTestId("step-actions")).not.toContainText("payer");
  await page.getByRole("button", { name: "Change who pays for this visit" }).click();
  await expect(stepNow(card(page))).toContainText("Eligibility check");
  await expect(card(page)).toContainText("Checking eligibility with NPHIES…");
  await expect(stepNow(card(page))).toContainText("Choose payer");
  const taw = page.getByTestId("payer-option-TAW-SILVER");
  await expect(taw).toContainText("Not eligible");
  await expect(taw).toContainText("Policy expired on 30 Sep");
  await expect(taw.getByRole("button", { name: /Choose/ })).toHaveCount(0);
  /* nothing outside the eligibility result is loaded until searched for */
  await expect(card(page)).not.toContainText("Charity");
  await expect(page.getByTestId("payer-option-BUPA-GOLD")).toContainText("Consultation SAR");
  /* the table of benefits opens in place */
  await page.getByTestId("payer-option-BUPA-GOLD").getByRole("button", { name: "Table of benefits" }).click();
  await expect(page.getByTestId("tob")).toContainText("Consultation (GP & specialist)");
  /* cash needs no policy details */
  await page.getByRole("button", { name: "Choose Cash / Self-pay" }).click();
  await expect(card(page)).toContainText("Payer set — Cash / Self-pay");
  await expect(card(page).locator('li[data-state="skip"]')).toContainText("Policy details");
  await expect(page.getByTestId("visit-payer")).toContainText("Cash / Self-pay");
  expect(await world<string>(page, "(w)=>w.cases.find(c=>c.id===30).history[1].tx")).toContain("Payer changed");

  /* an insurer: the policy details come filled from NPHIES */
  await page.getByRole("button", { name: "Change who pays for this visit" }).click();
  await page.getByRole("button", { name: "Choose BUPA · GOLD" }).click();
  await expect(stepNow(card(page))).toContainText("Policy details");
  await expect(card(page).locator('[data-f="policyNo"]')).toHaveValue("80737");
  await expect(card(page).locator('[data-f="cardId"]')).toHaveValue("3234 3435 1");
  await page.getByTestId("payer-save").click();
  await expect(page.getByTestId("visit-payer")).toContainText("BUPA · GOLD");

  /* an internal charity payer: a reference is required, and it approves on its own */
  await page.getByRole("button", { name: "Change who pays for this visit" }).click();
  await page.getByRole("button", { name: "Enter manually" }).click();
  await expect(page.getByTestId("payer-save")).toBeDisabled();
  await card(page).locator('[data-f="group"]').fill("charity");
  await expect(page.getByTestId("payer-matches").locator("[data-pick]")).toHaveCount(1);
  await page.getByTestId("payer-matches").getByRole("button", { name: /Al Habib Charity Fund/ }).click();
  await expect(card(page).locator('[data-f="contract"]')).toHaveValue("Charity programme 2026");
  await expect(page.getByTestId("payer-save")).toBeDisabled();
  await card(page).locator('[data-f="policyNo"]').fill("CH-2026-0412");
  await page.getByTestId("payer-save").click();
  await expect(card(page)).toContainText("approved internally");
  const c = await world<{ payerId: string; ins: string }>(page, "(w)=>{const c=w.cases.find(c=>c.id===30);return {payerId:c.payerId,ins:c.consult.ins}}");
  expect(c).toEqual({ payerId: "CH-HABIB", ins: "approved" });
});

test("the profile's payer: 1063301 has a new GIG policy on NPHIES", async ({ page }) => {
  await openPatient(page, "1063301");
  await page.getByRole("button", { name: "Change the patient's payer" }).click();
  const pp = page.getByTestId("profile-payer");
  await expect(pp.getByTestId("payer-option-GIG-C")).toContainText("Eligible · new");
  await pp.getByRole("button", { name: "Choose GIG · CLASS C" }).click();
  await expect(pp.locator('[data-f="policyNo"]')).toHaveValue("55021");
  await page.getByTestId("payer-save").click();
  await expect(pp).toContainText("Set GIG · CLASS C as RASANGIKA’s payer?");
  await expect(pp).toContainText("No open visit — the payer is used for the next visit.");
  await pp.getByRole("button", { name: "Save payer" }).click();
  await expect(page.getByTestId("payer-button")).toContainText("GIG · CLASS C");
  expect(await world<string[]>(page, "(w)=>w.patients['1063301'].payers.map(p=>p.id)")).toEqual(["GIG-C", "CASH"]);
});

test("a patient with no visit today can still be given one — walk-in on the new GIG policy", async ({ page }) => {
  await page.getByRole("searchbox", { name: "Find a patient" }).fill("rasangika");
  await page.getByRole("button", { name: /RASANGIKA/ }).click();
  await page.getByRole("button", { name: /Walk-in visit/ }).click();
  const wk = page.getByTestId("walkin");
  /* the patient is already chosen, so it starts on visit details */
  await expect(stepNow(wk)).toContainText("Visit details");
  await expect(wk.locator('li[data-state="done"]')).toContainText("Patient");
  await pick(page, "Clinic", "CARDIOLOGY");
  await expect(wk).toContainText("Consultation fee for CARDIOLOGY is SAR 300.00");
  await wk.getByRole("button", { name: "Next · orders" }).click();
  await expect(wk.getByRole("button", { name: "Skip · no orders" })).toBeVisible();
  await wk.getByRole("button", { name: "Skip · no orders" }).click();
  /* the payer stage runs the same eligibility check as the visit */
  await expect(wk).toContainText("Checking eligibility with NPHIES…");
  await expect(wk.getByRole("button", { name: "Create the visit" })).toHaveCount(0);
  await wk.getByRole("button", { name: "Choose GIG · CLASS C" }).click();
  await page.getByTestId("payer-save").click();
  await expect(stepNow(wk)).toContainText("Review");
  await expect(page.getByTestId("walkin-review")).toContainText("GIG · CLASS C");
  await wk.getByRole("button", { name: "Create the visit" }).click();
  await expect(wk).toContainText("Visit created for RASANGIKA JAYAWARDHANA.");
  await wk.getByRole("button", { name: "Open the visit" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "CONSULT_WAIT");
  const v = await world<{ clinic: string; payerId: string; ins: string; types: string[]; policy: string }>(page,
    "(w)=>{const c=w.cases.find(c=>c.mrn==='1063301');return {clinic:c.clinic,payerId:c.payerId,ins:c.consult.ins,types:c.history.map(h=>h.type),policy:c.policy.policyNo}}");
  expect(v).toEqual({ clinic: "CARDIOLOGY", payerId: "GIG-C", ins: "pending", types: ["APPROVAL", "PAYER", "ELIGIBILITY", "VISIT"], policy: "55021" });
});

test("a patient who already has an open visit can be given another — and the profile now lists both", async ({ page }) => {
  await page.getByRole("searchbox", { name: "Find a patient" }).fill("mohammed");
  await page.getByRole("button", { name: /MOHAMMED AL QAHTANI/ }).click();
  await page.getByRole("button", { name: /Walk-in visit/ }).click();
  const wk = page.getByTestId("walkin");
  await expect(page.getByTestId("walkin-sub")).toContainText("MOHAMMED");
  await pick(page, "Clinic", "ENT");
  await pick(page, "Visit type", "Follow-up");
  await wk.getByRole("button", { name: "Next · orders" }).click();
  await wk.getByRole("button", { name: /Complete Blood Count|Vitamin D Total/ }).first().click();
  await wk.getByRole("button", { name: /Next · payer \(1 order\(s\)\)/ }).click();
  await wk.getByRole("button", { name: "Choose BUPA · GOLD" }).click();
  await page.getByTestId("payer-save").click();
  await wk.getByRole("button", { name: "Create the visit" }).click();
  await wk.getByRole("button", { name: "Open the visit" }).click();
  await expect(page.getByTestId("visit-ctx")).toContainText("Follow-up");
  await openPatient(page, "7000667");
  await expect(page.getByTestId("visits-on-file")).toHaveText("6");
  await expect(page.locator('[data-testid^="visit-row-"]')).toHaveCount(6);
});

test("the invoices screen loads nothing until asked, finds by number, views and reprints", async ({ page }) => {
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await expect(page.getByTestId("invoice-filters")).toContainText("What should be loaded?");
  await expect(page.getByTestId("invoice-table")).toHaveCount(0);
  await page.getByRole("radio", { name: "Any date" }).click();
  await expect(page.getByRole("button", { name: "Load invoices" })).toBeDisabled();
  await expect(page.getByTestId("invoice-filters")).toContainText("Any date needs a search");
  /* every visit invoice on file (wallet documents are not visit invoices — as in v3's allInvoices) */
  await page.getByRole("searchbox", { name: "Find an invoice" }).fill("inv-");
  await page.getByRole("button", { name: "Load invoices" }).click();
  const all = await world<number>(page, "(w)=>w.cases.reduce((a,c)=>a+c.invoices.length,0)");
  await expect(page.getByTestId("invoice-table").locator('[data-row="invoice"]')).toHaveCount(all);
  await page.getByRole("button", { name: "Change filters" }).click();
  await page.getByRole("searchbox", { name: "Find an invoice" }).fill("INV-771204");
  await page.getByRole("button", { name: "Load invoices" }).click();
  await expect(page.getByTestId("invoice-table").locator("[data-inv]")).toHaveCount(1);
  await page.evaluate(() => { (globalThis as unknown as { print: () => void; __printed: number }).__printed = 0; (globalThis as unknown as { print: () => void }).print = () => { (globalThis as unknown as { __printed: number }).__printed++; }; });
  await page.getByRole("button", { name: "View INV-771204" }).click();
  await expect(page.getByTestId("inv-doc")).toContainText("MOHAMMED AL QAHTANI");
  await page.getByRole("button", { name: "Reprint invoice" }).click();
  await expect(page.getByText("Invoice INV-771204 sent to the printer")).toBeVisible();
  expect(await page.evaluate(() => (globalThis as unknown as { __printed: number }).__printed)).toBe(1);
  expect(await world<string>(page, "(w)=>w.cases.find(c=>c.id===2).history[0].type")).toBe("REPRINT");
});

test("the profile's invoices: collapsed by default, headline figures, a link to the full screen", async ({ page }) => {
  await openPatient(page, "7000667");
  const pi = page.getByTestId("patient-invoices");
  /* collapsed by default, but the headline figures are still there */
  await expect(pi).toContainText("7 on file incl. 3 advance / credit");
  await expect(pi.getByTestId("invoice-table")).toHaveCount(0);
  await pi.getByRole("button", { name: /Invoices/ }).click();
  await expect(pi.getByTestId("invoice-table").locator("[data-inv]")).toHaveCount(7);
  await pi.getByText("Pair related invoices").click();
  await expect(pi.getByTestId("invoice-table").locator('[data-row="group"]').first()).toContainText("V1000");
  /* and a link through to the full invoices screen, filtered to this patient */
  await pi.getByRole("link", { name: "all invoices ›" }).click();
  await expect(page.getByRole("searchbox", { name: "Find an invoice" })).toHaveValue("7000667");
  await expect(page.getByTestId("invoice-table").locator("[data-inv]")).toHaveCount(4);
});

test("the event pop-up goes to the invoices screen, filtered to this patient", async ({ page }) => {
  await openVisit(page, 2, "7000667");
  await page.getByTestId("event").filter({ hasText: "Consultation paid" }).click();
  await page.getByRole("button", { name: "Go to invoices" }).click();
  await expect(page.getByRole("searchbox", { name: "Find an invoice" })).toHaveValue("7000667");
  await expect(page.getByTestId("invoice-table").locator("[data-inv]").first()).toBeVisible();
});

test("dark theme: the wallet, the payer story and the invoices screen render", async ({ page }) => {
  await page.evaluate(() => (globalThis as unknown as Vida).__vida.ui.getState().setTheme("dark"));
  await openVisit(page, 30, "7000667");
  await page.getByTestId("wallet-chip").click();
  await expect(wallet(page)).toBeVisible();
  await page.getByRole("button", { name: "Change who pays for this visit" }).click();
  await expect(page.getByTestId("payer-option-BUPA-GOLD")).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Invoices", exact: true }).click();
  await expect(page.getByTestId("invoice-filters")).toBeVisible();
});
