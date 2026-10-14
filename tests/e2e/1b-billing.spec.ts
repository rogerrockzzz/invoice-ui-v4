import { expect, test, type Page } from "@playwright/test";

/* Checkpoint 1b — visit + orders invoicing, the payment pop-up, the timeline and the Simulate panel.
   Test names and comments quote the matching sections of the v3 smoke suite
   (docs/Devin Invoice UI/_smoke_journey3.html). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00"));
  await page.goto("/");
});

/* the app's test hook (src/main.tsx); this project has no DOM lib, so it is typed here */
type Vida = { __vida: { ui: { getState(): { openVisit(id: number, mrn: string): void; setTheme(t: string): void } }; world: { getState(): unknown } } };
const openVisit = (page: Page, id: number, mrn: string) =>
  page.evaluate(([i, m]) => (globalThis as unknown as Vida).__vida.ui.getState().openVisit(i as number, m as string), [id, mrn]);
const world = <T,>(page: Page, fn: string, arg?: unknown) =>
  page.evaluate(([f, a]) => new Function("w", "a", `return (${f})(w, a)`)((globalThis as unknown as Vida).__vida.world.getState(), a), [fn, arg]) as Promise<T>;
const q = (page: Page) => page.getByTestId("step-q");
const card = (page: Page) => page.getByTestId("step-card");
const actions = (page: Page) => page.getByTestId("step-actions").getByRole("button");
const drawer = (page: Page) => page.getByRole("dialog", { name: /^Payment ·/ });
const mode = (page: Page, name: string | RegExp) => drawer(page).getByRole("radio", { name, exact: typeof name === "string" });
const sim = async (page: Page, event: string) => {
  if (!(await page.getByTestId("sim-panel").isVisible())) await page.getByRole("button", { name: "Simulate" }).click();
  await page.getByTestId("sim-panel").getByRole("button", { name: event }).click();
};
const stepNow = (page: Page) => card(page).locator('li[aria-current="step"]');

test("visit 2: bill the 3 approved, split Span 100 + OPEN advance", async ({ page }) => {
  await page.getByRole("searchbox", { name: "Find a patient" }).fill("7000667");
  await page.getByRole("button", { name: /^Profile/ }).click();
  await page.getByTestId("tile-2").getByRole("button", { name: /Open/ }).click();

  await expect(page.getByRole("radio", { name: /Orders invoicing/ })).toBeChecked();
  await expect(stepNow(page)).toContainText("Bill orders");
  await expect(q(page)).toHaveText("4 procedures were ordered. 3 have approval, 1 does not.");
  await expect(page.getByTestId("step-amt")).toContainText("SAR 273.69");
  await expect(page.getByTestId("ded-left")).toHaveText("SAR 143.00");

  await page.getByRole("button", { name: "Bill the 3 approved now" }).click();
  /* the charge is prepared, but nothing is invoiced yet */
  await expect(q(page)).toHaveText("How is MOHAMMED paying for the orders — SAR 273.69?");
  expect(await world<number>(page, "(w)=>w.cases.find(c=>c.id===2).invoices.length")).toBe(1);
  /* two buttons only — the modes live in the pop-up; the desk is the commonest, so it leads */
  await expect(actions(page)).toHaveText(["Take payment at the desk", "Send payment link"]);
  /* the payer is locked once anything is invoiced */
  await expect(page.getByTestId("visit-payer")).toContainText("BUPA · GOLD");

  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await expect(drawer(page)).toBeVisible();
  for (const m of ["Span", "Visa", "Master card", "Cash"]) await expect(mode(page, m)).toBeVisible();
  await expect(mode(page, /^OPEN/)).toBeVisible(); /* the pot holds money, so it is on the face */
  /* the rarer production modes sit behind "more", not on the face */
  await expect(mode(page, "MADA")).toHaveCount(0);
  await drawer(page).getByTestId("more-modes").click();
  for (const m of ["MADA", "Amex", "DOCTOR", "CLINIC", "Inter-company referral", "Cash from finance"])
    await expect(page.getByRole("menuitem", { name: new RegExp(`^${m}`) })).toBeVisible();
  await page.keyboard.press("Escape");

  await mode(page, "Span").click();
  const amt = drawer(page).getByLabel("Amount for this payment");
  await amt.fill("100");
  await amt.press("Tab");
  await expect(drawer(page).getByTestId("part-hint")).toContainText("SAR 173.69 would still be unpaid");
  await drawer(page).getByRole("button", { name: /Add this SAR 100.00/ }).click();
  await expect(drawer(page).getByTestId("taken-part")).toContainText("SAR 100.00");
  await mode(page, /^OPEN/).click();
  await expect(drawer(page).getByTestId("advance-box")).toContainText("Wallet after this");
  await expect(drawer(page).getByTestId("advance-box")).toContainText("SAR 326.31");
  await expect(drawer(page).getByTestId("drawer-total")).toContainText("Span SAR 100.00 + OPEN SAR 173.69");
  await drawer(page).getByRole("button", { name: "Confirm 2 payments" }).click();

  await expect(drawer(page)).toHaveCount(0);
  await expect(page.getByText("Payment received · SAR 273.69")).toBeVisible();
  await expect(page.getByTestId("wallet-advance")).toHaveText("SAR 326.31");
  const inv = await world<{ id: string; via: string; payments: { mode: string; amount: number }[] }>(page, "(w)=>w.cases.find(c=>c.id===2).invoices[0]");
  expect(inv.via).toBe("Span + OPEN");
  expect(inv.payments.map((p) => [p.mode, p.amount])).toEqual([["Span", 100], ["OPEN", 173.69]]);
  const led = await world<{ type: string; amount: number; invoiceId: string }>(page, "(w)=>w.patients['7000667'].ledger[0]");
  expect([led.type, led.amount, led.invoiceId]).toEqual(["ADV_USED", 173.69, inv.id]);
  /* exactly one payment entry, and it names the invoice created */
  const paid = page.getByTestId("event").filter({ hasText: "Orders paid — SAR 273.69" });
  await expect(paid).toHaveCount(1);
  await expect(paid).toContainText(`invoice ${inv.id} created`);
  await expect(q(page)).toHaveText("Waiting for approval on 1 order(s).");
});

test("visit 3: approval → bill → link → paid → doctor → orders, then hold and release", async ({ page }) => {
  await openVisit(page, 3, "7100482");
  await expect(q(page)).toHaveText("Approval not received for the consultation — please wait.");
  await page.getByRole("button", { name: "Check for approval" }).click();
  await expect(q(page)).toHaveText("Approval received. Do you wish to bill the consultation?");
  await page.getByRole("button", { name: "Yes, bill it" }).click();
  await expect(q(page)).toHaveText("How is NOURA paying for the consultation — SAR 71.88?");
  /* and the link button just sends the link */
  await page.getByRole("button", { name: "Send payment link" }).click();
  await expect(q(page)).toHaveText("Waiting for NOURA to pay SAR 71.88.");
  await expect(page.getByTestId("step-sub")).toContainText("0553 220 118");
  await sim(page, "Link goes unpaid for 14 minutes");
  await expect(page.getByTestId("step-sub")).toContainText("no payment after 14 minutes");
  const before = await world<number>(page, "(w)=>w.cases.find(c=>c.id===3).history.length");
  await sim(page, "Patient pays the open link");
  /* exactly one new history entry, and it names the invoice created */
  const h = await world<{ n: number; tx: string; sub: string; inv: string }>(page,
    "(w)=>{const c=w.cases.find(c=>c.id===3);return {n:c.history.length,tx:c.history[0].tx,sub:c.history[0].sub,inv:c.invoices[0].id}}");
  expect(h.n).toBe(before + 1);
  expect(h.tx).toBe("<b>Consultation paid</b> — SAR 71.88");
  expect(h.sub).toContain(`Payment link · invoice ${h.inv} created`);

  /* first the patient is sent to the doctor — nothing moves until the doctor starts */
  await expect(q(page)).toHaveText("NOURA can now see the doctor.");
  await expect(stepNow(page)).toContainText("See the doctor");
  await page.getByRole("button", { name: "Check if the doctor has started" }).click();
  await expect(page.getByTestId("step-sub")).toContainText("the doctor has not started yet");
  await page.getByRole("button", { name: "Check if the doctor has started" }).click();
  await expect(q(page)).toHaveText("NOURA is with the doctor.");
  await expect(page.getByRole("radio", { name: /Orders invoicing/ })).toBeChecked();
  /* first check finds nothing, second brings the orders in */
  await page.getByRole("button", { name: "Check for new orders" }).click();
  await expect(page.getByTestId("step-sub")).toContainText("nothing ordered yet");
  await page.getByRole("button", { name: "Check for new orders" }).click();
  await expect(q(page)).toHaveText("3 procedures were ordered. 2 have approval, 1 does not.");
  /* both choices are offered */
  await expect(actions(page)).toHaveText(["Bill the 2 approved now", "Wait for all approvals"]);
  /* and the orders can be expanded */
  await card(page).getByRole("button", { name: "3 order(s) still to bill" }).click();
  await expect(card(page).locator('[data-state="pend"]')).toHaveCount(1);
  await expect(card(page).getByRole("row")).toHaveCount(4);

  await page.getByRole("button", { name: "Wait for all approvals" }).click();
  /* the card separates what is known from what is still a guess */
  await expect(page.getByTestId("step-sub")).toContainText("2 approved order(s) are being held with them.");
  await expect(page.getByTestId("step-amts")).toContainText("ready to bill · 2 approved");
  await expect(page.getByTestId("step-amts")).toContainText("up to this much more, if approved in full");
  /* while waiting, there is a way back to billing the approved ones */
  await page.getByRole("button", { name: "Bill the 2 approved order(s) now" }).click();
  await expect(page.getByText("2 approved order(s) ready to bill")).toBeVisible();
  await expect(actions(page).first()).toHaveText("Bill the 2 approved now");
  /* go back on hold, then let the approval land so everything bills together */
  await page.getByRole("button", { name: "Wait for all approvals" }).click();
  await page.getByRole("button", { name: "Check approval" }).click();
  await expect(page.getByTestId("step-sub")).toContainText("no answer yet");
  await page.getByRole("button", { name: "Check approval" }).click();
  await expect(q(page)).toHaveText("3 procedure(s) were ordered and are approved. Bill them?");
});

test("visit 1: cash at the desk — notes, change, and the modes swap their fields", async ({ page }) => {
  await openVisit(page, 1, "7000203");
  await page.getByRole("button", { name: "Yes, bill it" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await expect(drawer(page).getByTestId("drawer-amount")).toHaveText("SAR 46.00");
  /* switching mode inside the pop-up swaps its fields */
  await mode(page, "Visa").click();
  await expect(drawer(page).getByLabel("Approval no.")).toBeVisible();
  await expect(drawer(page).getByLabel("Card last 4")).toBeVisible();
  await drawer(page).getByTestId("more-modes").click();
  await page.getByRole("menuitem", { name: /^Cash from finance/ }).click();
  await expect(drawer(page).getByLabel("Finance voucher no.")).toBeVisible();
  await mode(page, /^Credit/).click();
  await expect(drawer(page).getByTestId("credit-box")).toContainText("Credit after this");
  await mode(page, "Cash").click();
  await drawer(page).getByRole("button", { name: "Clear" }).click();
  await drawer(page).getByRole("button", { name: "Add a SAR 100 note" }).click();
  await expect(drawer(page).getByLabel("Change to give back")).toHaveValue("54.00");
  await drawer(page).getByRole("button", { name: "Confirm cash payment" }).click();
  await expect(page.getByText("Payment received · SAR 46.00")).toBeVisible();
  const inv = await world<{ via: string; viaDetail: string }>(page, "(w)=>w.cases.find(c=>c.id===1).invoices[0]");
  expect(inv).toMatchObject({ via: "Cash", viaDetail: "tendered SAR 100.00 (1×SAR 100) · change SAR 54.00" });
  await expect(q(page)).toHaveText("WADHA can now see the doctor.");
});

test("a consultation put on credit is never billed twice — the same holds for orders", async ({ page }) => {
  await openVisit(page, 1, "7000203");
  await expect(page.getByTestId("wallet-credit")).toHaveText("SAR 0.00");
  await page.getByRole("button", { name: "Yes, bill it" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await mode(page, /^Credit/).click();
  await drawer(page).getByRole("button", { name: "Put on credit" }).click();
  await expect(page.getByText("On credit · SAR 46.00")).toBeVisible();
  await expect(page.getByTestId("wallet-credit")).toHaveText("SAR 46.00");
  expect(await world<string>(page, "(w)=>w.patients['7000203'].ledger[0].type")).toBe("CREDIT_RAISED");
  /* the flow must move on, not ask for the consultation again */
  await expect(q(page)).toHaveText("WADHA can now see the doctor.");
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Check if the doctor has started" }).click();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Check for new orders" }).click();
  await page.getByRole("button", { name: "Bill the 2 approved now" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await mode(page, /^Credit/).click();
  await drawer(page).getByRole("button", { name: "Put on credit" }).click();
  /* the same holds for orders put on credit */
  await expect(q(page)).toHaveText("Waiting for approval on 1 order(s).");
  const credit = await world<number>(page, "(w)=>w.cases.find(c=>c.id===1).invoices.filter(i=>i.via==='Credit').length");
  expect(credit).toBe(2);
});

test("visit 20: the consultation was billed at the other branch, so it is not asked for here", async ({ page }) => {
  await openVisit(page, 20, "7000667");
  await expect(page.getByRole("radio", { name: /^Visit invoicing/ })).toHaveCount(0);
  await expect(page.getByTestId("received-from")).toContainText("AL TAKHASSUSI HOSPITAL");
  await expect(q(page)).toHaveText("2 procedures were ordered at AL TAKHASSUSI HOSPITAL. 1 has approval, 1 does not.");
  await expect(page.getByTestId("step-sub")).toContainText("Collected here on behalf of AL TAKHASSUSI HOSPITAL.");
  await card(page).getByRole("button", { name: "2 order(s) still to bill" }).click();
  await expect(card(page).getByTestId("branch-tag")).toHaveCount(2);
  /* bill the approved one — the invoice records where the work was done */
  await page.getByRole("button", { name: "Bill the 1 approved now" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await drawer(page).getByRole("button", { name: "Confirm cash payment" }).click();
  const inv = await world<{ branch: string }>(page, "(w)=>w.cases.find(c=>c.id===20).invoices[0]");
  expect(inv.branch).toBe("AL TAKHASSUSI HOSPITAL");
  await expect(page.getByTestId("event").first()).toContainText("performed at AL TAKHASSUSI HOSPITAL");
});

test("the timeline: comments, event detail and the invoice preview", async ({ page }) => {
  await openVisit(page, 2, "7000667");
  await page.getByRole("button", { name: /Leave a comment/ }).click();
  await page.getByRole("textbox", { name: /Leave a comment/ }).fill("Patient asked for a printed copy");
  await page.getByText("Mark as important — pin it to the top").click();
  await page.getByRole("button", { name: "Save comment" }).click();
  await expect(page.getByText("Important comment saved")).toBeVisible();
  await expect(page.getByTestId("pinned")).toContainText("Patient asked for a printed copy");

  await page.getByRole("button", { name: "Detail: Consultation paid — SAR 65.55" }).click();
  const ev = page.getByRole("dialog", { name: "Payment" });
  await expect(ev).toContainText("Patient share");
  await expect(ev).toContainText("SAR 262.20");
  await ev.getByRole("button", { name: "Preview invoice INV-771204" }).click();
  await expect(page.getByTestId("inv-id")).toHaveText("INV-771204");
  await expect(page.getByTestId("inv-total")).toHaveText("SAR 65.55");
  await page.getByRole("dialog", { name: "INV-771204" }).getByRole("button", { name: "Close", exact: true }).last().click();
  await expect(page.getByTestId("inv-doc")).toHaveCount(0);

  /* an invoice number in a history line opens the invoice, not the event */
  await page.getByTestId("event").filter({ hasText: "Consultation paid" }).getByRole("link", { name: "INV-771204" }).click();
  await expect(page.getByTestId("inv-id")).toHaveText("INV-771204");
});

test("a locked story says why, and switching stories keeps the visit", async ({ page }) => {
  await openVisit(page, 1, "7000203");
  await page.getByRole("radio", { name: /^Orders invoicing/ }).click();
  await expect(page.getByText("Not just now")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^Visit invoicing/ })).toBeChecked();
  /* the "Back" step button cancels the prepared charge */
  await page.getByRole("button", { name: "Yes, bill it" }).click();
  await card(page).getByRole("button", { name: "Back" }).click();
  await expect(page.getByText("Nothing was charged.")).toBeVisible();
  await expect(q(page)).toHaveText("Approval received. Do you wish to bill the consultation?");
});

test("the Simulate panel says which visit it acts on, and Reset restores the seed", async ({ page }) => {
  await openVisit(page, 4, "8825140");
  await page.getByRole("button", { name: "Simulate" }).click();
  await expect(page.getByTestId("sim-panel")).toContainText("World events · AHMED");
  await expect(page.getByTestId("sim-panel")).toContainText("V100004");
  await sim(page, "Doctor places 3 orders");
  await expect(page.getByText("More orders placed").or(page.getByText("Orders placed"))).toBeVisible();
  await page.getByRole("button", { name: "Hide" }).click();
  await expect(page.getByTestId("sim-panel")).toHaveCount(0);
  /* Reset is v3's page reload: the seed comes back and the panel starts folded */
  await page.getByRole("button", { name: "Simulate" }).click();
  await page.getByTestId("sim-panel").getByRole("button", { name: "Reset" }).click();
  await expect(page.getByText("Search for a patient to begin")).toBeVisible();
  expect(await world<number>(page, "(w)=>w.cases.find(c=>c.id===4).orders.length")).toBe(1);
  await expect(page.getByTestId("sim-panel")).toHaveCount(0);
});

test("dark theme smoke: the visit and the pop-up render", async ({ page }) => {
  await page.evaluate(() => (globalThis as unknown as Vida).__vida.ui.getState().setTheme("dark"));
  await openVisit(page, 2, "7000667");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Bill the 3 approved now" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await expect(drawer(page)).toBeVisible();
});
