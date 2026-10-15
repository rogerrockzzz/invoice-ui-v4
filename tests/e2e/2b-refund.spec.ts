import { expect, test, type Page } from "@playwright/test";

/* Checkpoint 2b — the Refund story. Comments quote the matching sections of the v3 smoke suite
   (docs/Devin Invoice UI/_smoke_journey3.html). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00"));
  await page.goto("/");
});

type Vida = { __vida: { ui: { getState(): { openVisit(id: number, mrn: string): void; openPatient(mrn: string): void; set(p: object): void } }; world: { getState(): unknown } } };
const openVisit = (page: Page, id: number, mrn: string) =>
  page.evaluate(([i, m]) => (globalThis as unknown as Vida).__vida.ui.getState().openVisit(i as number, m as string), [id, mrn]);
const openPatient = (page: Page, mrn: string) => page.evaluate((m) => (globalThis as unknown as Vida).__vida.ui.getState().openPatient(m), mrn);
const world = <T,>(page: Page, fn: string) =>
  page.evaluate((f) => new Function("w", `return (${f})(w)`)((globalThis as unknown as Vida).__vida.world.getState()), fn) as Promise<T>;
const card = (page: Page) => page.getByTestId("step-card");
const stepNow = (page: Page) => card(page).locator('li[aria-current="step"]');
const refundDrawer = (page: Page) => page.getByRole("dialog", { name: /^Refund ·/ });

test("a refund runs through its four stages and ends with its result", async ({ page }) => {
  await openVisit(page, 21, "7000203");
  await page.getByRole("radio", { name: /^Invoices \/ Refund/ }).click();
  /* it lists the invoices first, at the first stage */
  await expect(card(page)).toHaveAttribute("data-step", "REFUND_LIST");
  await expect(stepNow(page)).toContainText("Invoices");
  await expect(card(page).getByTestId("step-q")).toHaveText("1 invoice(s) on this visit");
  await expect(card(page)).toContainText("1 can be refunded — only lines not yet performed.");
  await card(page).getByRole("button", { name: "Refund" }).click();

  /* choosing an invoice opens the refund itself — stage two, in the card */
  await expect(card(page)).toHaveAttribute("data-step", "REFUND_WORK");
  await expect(stepNow(page)).toContainText("Lines & reason");
  await expect(card(page).getByTestId("step-q")).toHaveText("Refund WADHA for INV-690221?");
  await expect(card(page).getByTestId("refund-amount")).toHaveText("SAR 73.60");
  await expect(card(page).getByTestId("refund-amt")).toContainText("NCCI share SAR 294.40 reversed · deductible SAR 64.00 released");
  const go = card(page).getByRole("button", { name: "Yes, refund SAR 73.60" });
  /* it refuses to refund without a reason */
  await expect(go).toBeDisabled();
  await card(page).getByRole("textbox", { name: /Reason/ }).fill("ab");
  await expect(go).toBeDisabled();
  await card(page).getByRole("textbox", { name: /Reason/ }).fill("test cancelled");
  await expect(go).toBeEnabled();
  await go.click();

  /* the refund mode is chosen in the payment slide-in */
  const d = refundDrawer(page);
  await expect(stepNow(page)).toContainText("Refund mode");
  await expect(d.getByTestId("refund-box")).toContainText("SAR 73.60 goes back to the patient.");
  await expect(d.getByTestId("refund-box")).toContainText("INV-690221");
  for (const m of ["Cash", "Span", "Visa", "Master card", "Advance wallet"]) await expect(d.getByRole("radio", { name: m })).toBeVisible();
  await expect(d.getByRole("radio", { name: "Credit" })).toHaveCount(0);
  /* cancelling the slide-in comes back to the card exactly as it was */
  await d.getByRole("button", { name: "Cancel" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "REFUND_WORK");
  await expect(card(page).getByRole("textbox", { name: /Reason/ })).toHaveValue("test cancelled");
  await card(page).getByRole("button", { name: "Yes, refund SAR 73.60" }).click();
  await refundDrawer(page).getByRole("radio", { name: "Advance wallet" }).click();
  await expect(refundDrawer(page).getByTestId("refund-box")).toContainText("Credited to the advance wallet");
  await refundDrawer(page).getByRole("button", { name: "Refund by advance wallet" }).click();

  /* it ends with its result */
  await expect(card(page)).toHaveAttribute("data-step", "STORY_DONE");
  await expect(stepNow(page)).toContainText("Refunded");
  await expect(card(page)).toContainText("Refunded SAR 73.60 on INV-690221");
  const st = await world<{ refunded: number; open: number; rinv: string; ded: number; led: string }>(page,
    "(w)=>{const c=w.cases.find(x=>x.id===21);return {refunded:c.invoices[0].refundedTotal,open:w.patients['7000203'].wallet.advance.Open,rinv:c.refundInvoices[0].id,ded:c.dedUsed,led:w.patients['7000203'].ledger[0].type}}");
  expect(st.refunded).toBe(73.6);
  expect(st.open).toBe(73.6);
  expect(st.led).toBe("REFUND_IN");
  expect(st.rinv).toMatch(/^RFD-/);
  await expect(page.getByTestId("event").first()).toContainText("Refunded SAR 73.60");

  /* the refund invoice has its own document, pointing at the invoice it refunds */
  await card(page).getByRole("button", { name: `View refund invoice ${st.rinv}` }).click();
  const doc = page.getByRole("dialog");
  await expect(doc).toContainText("REFUND INVOICE");
  await expect(doc).toContainText("test cancelled");
  await expect(doc.getByTestId("inv-total")).toHaveText("−SAR 73.60");
  await doc.getByRole("link", { name: "INV-690221" }).click();
  await expect(page.getByRole("dialog")).toContainText("Refunds against this invoice");
  await expect(page.getByRole("dialog")).toContainText("Refunded — SAR 73.60 returned");
  /* nothing is left to refund on it */
  await expect(page.getByRole("dialog").getByRole("button", { name: "Refund" })).toHaveCount(0);
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).last().click();
  await card(page).getByRole("button", { name: "All invoices" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "REFUND_LIST");
  await expect(card(page).getByTestId("step-q")).toHaveText("1 invoice(s) on this visit · 1 refund invoice(s) · 1 advance / credit");
});

test("refunding from the invoice pop-up takes you to that visit's Refund story; lines can be unticked", async ({ page }) => {
  /* pay visit 2's three approved orders, so there is something not yet performed to give back */
  await openVisit(page, 2, "7000667");
  await page.getByRole("button", { name: "Bill the 3 approved now" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await page.getByRole("dialog", { name: /^Payment ·/ }).getByRole("button", { name: "Confirm cash payment" }).click();
  const inv = await world<string>(page, "(w)=>w.cases.find(x=>x.id===2).invoices[0].id");
  await openPatient(page, "7000667");
  await page.evaluate((id) => (globalThis as unknown as Vida).__vida.ui.getState().set({ invPop: id }), inv);
  await page.getByRole("dialog").getByRole("button", { name: "Refund" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card(page)).toHaveAttribute("data-step", "REFUND_WORK");
  await expect(page.getByRole("radio", { name: /^Invoices \/ Refund/ })).toBeChecked();
  await expect(card(page).getByTestId("step-q")).toHaveText(`Refund MOHAMMED for ${inv}?`);
  await expect(card(page).getByTestId("refund-amount")).toHaveText("SAR 273.69");
  await card(page).getByRole("button", { name: /^Lines · 3 of 3 selected/ }).click();
  const lines = card(page).getByTestId("refund-line");
  await expect(lines).toHaveCount(3);
  /* every refundable line starts ticked; unticking one lowers the refund */
  for (const cb of await card(page).getByTestId("refund-lines").getByRole("checkbox").all()) await expect(cb).toBeChecked();
  await lines.first().getByRole("checkbox").click({ force: true });
  await expect(card(page).getByRole("button", { name: /^Lines · 2 of 3 selected/ })).toBeVisible();
  const amt = Number((await card(page).getByTestId("refund-amount").textContent())!.replace(/[^0-9.]/g, ""));
  expect(amt).toBeLessThan(273.69);
  /* "Another invoice" goes back to the list */
  await card(page).getByRole("button", { name: "Another invoice" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "REFUND_LIST");
  await expect(card(page).getByTestId("refund-row")).toHaveCount(2);
  await expect(card(page).locator(`[data-inv="${inv}"]`).getByRole("button", { name: "Refund" })).toBeVisible();
  /* the consultation was seen by the doctor, so it cannot be refunded */
  await expect(card(page).locator('[data-inv="INV-771204"]')).toContainText("Performed");
});
