import { expect, test, type Page } from "@playwright/test";

/* Checkpoint 3c — the package procedure visit prints its invoice at no charge; the print can be undone. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00"));
  await page.goto("/");
});

type Vida = { __vida: { ui: { getState(): { openVisit(id: number, mrn: string): void; openPatient(mrn: string): void } }; world: { getState(): unknown } } };
const openVisit = (page: Page, id: number, mrn: string) =>
  page.evaluate(([i, m]) => (globalThis as unknown as Vida).__vida.ui.getState().openVisit(i as number, m as string), [id, mrn]);
const openPatient = (page: Page, mrn: string) => page.evaluate((m) => (globalThis as unknown as Vida).__vida.ui.getState().openPatient(m), mrn);
const world = <T,>(page: Page, fn: string) =>
  page.evaluate((f) => new Function("w", `return (${f})(w)`)((globalThis as unknown as Vida).__vida.world.getState()), fn) as Promise<T>;
const card = (page: Page) => page.getByTestId("step-card");
const stepNow = (page: Page) => card(page).locator('li[aria-current="step"]');
const invPop = (page: Page) => page.getByTestId("inv-doc");

/* visit 2's package is paid, then its Treadmill Stress Test is booked from the profile — the new visit opens */
async function packageVisit(page: Page) {
  await openVisit(page, 2, "7000667");
  await page.getByRole("button", { name: "Bill the 3 approved now" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await page.getByRole("dialog", { name: /^Payment ·/ }).getByRole("button", { name: "Confirm cash payment" }).click();
  await expect(page.getByText("4 package procedures ready to book")).toBeVisible();
  await openPatient(page, "7000667");
  await page.getByRole("button", { name: "book a visit ›" }).click();
  const pop = page.getByRole("dialog", { name: "Book a visit for package procedures" });
  await pop.getByRole("checkbox", { name: "Book Treadmill Stress Test" }).dispatchEvent("click");
  await pop.getByRole("button", { name: "Create the visit · 1 procedure(s)" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "PKG_PRINT");
  return world<string>(page, "(w)=>w.cases.find(c=>c.id===2).invoices[0].id");
}

test("a package procedure prints its nil invoice, and the print can be undone and printed again", async ({ page }) => {
  const pkgInv = await packageVisit(page);
  await expect(stepNow(page)).toContainText("Print invoice");
  await expect(card(page).getByTestId("step-sub")).toHaveText(`Treadmill Stress Test · already paid inside Cardiac Care Package on ${pkgInv} · no charge.`);
  /* no consultation, no payer to change: this visit exists only to perform the procedure */
  await expect(page.getByRole("radio", { name: /^Visit invoicing/ })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /^Add orders/ })).toHaveCount(0);

  await card(page).getByRole("button", { name: "Yes, print it" }).click();
  const inv = await world<string>(page, "(w)=>w.cases[0].invoices[0].id");
  await expect(page.getByText(`Invoice ${inv} printed`)).toBeVisible();
  await expect(card(page)).toHaveAttribute("data-step", "PKG_DONE");
  await expect(stepNow(page)).toContainText("Recorded");
  await expect(card(page).getByTestId("step-q")).toHaveText("This package procedure has been recorded.");
  await expect(card(page).getByTestId("step-sub")).toHaveText(`${inv} printed at no charge · package paid on ${pkgInv}.`);
  await expect(page.getByTestId("event").first()).toContainText(`Package procedure invoice printed — ${inv}`);

  /* the printed invoice says where it was paid, and charges nothing */
  await card(page).getByTestId("step-sub").getByRole("link", { name: inv }).click();
  await expect(invPop(page)).toContainText("Cardiac Care Package");
  await expect(invPop(page)).toContainText(`on invoice ${pkgInv} — nothing charged here`);
  await expect(invPop(page).getByTestId("inv-foot")).toContainText("No charge — paid inside Cardiac Care Package");
  await expect(invPop(page).getByTestId("inv-total")).toHaveText("SAR 0.00");
  await page.getByRole("button", { name: "Close" }).last().click();

  /* undoing the print asks why */
  await card(page).getByRole("button", { name: `Undo the print · ${inv}` }).click();
  const pop = page.getByRole("dialog", { name: `Undo the printed invoice ${inv}?` });
  await expect(pop).toContainText("No money was charged on this invoice.");
  await expect(pop).toContainText(`${inv} is marked void and the procedure goes back to not yet printed.`);
  await expect(pop.getByTestId("void-lines")).toContainText("Treadmill Stress Test");
  const go = pop.getByRole("button", { name: "Undo the print" });
  await expect(go).toBeDisabled();
  await pop.getByRole("textbox", { name: /Reason/ }).fill("ab");
  await expect(go).toBeDisabled();
  await pop.getByRole("button", { name: "Keep it" }).click();
  await expect(pop).toHaveCount(0);
  await expect(card(page)).toHaveAttribute("data-step", "PKG_DONE");

  await card(page).getByRole("button", { name: `Undo the print · ${inv}` }).click();
  await pop.getByRole("textbox", { name: /Reason/ }).fill("printed on the wrong visit");
  await go.click();
  await expect(page.getByText(`Print undone · ${inv}`)).toBeVisible();
  await expect(card(page)).toHaveAttribute("data-step", "PKG_PRINT");
  await expect(page.getByTestId("event").first()).toContainText(`Package procedure print undone — ${inv} voided`);
  await expect(page.getByTestId("event").first()).toContainText("Treadmill Stress Test · printed on the wrong visit · no money was involved · can be printed again");
  const v = await world<{ paid: boolean; voided: { reason: string } }>(page, "(w)=>w.cases[0].invoices[0]");
  expect(v).toMatchObject({ paid: false, voided: { reason: "printed on the wrong visit" } });

  /* and it can be printed again, on a new invoice */
  await card(page).getByRole("button", { name: "Yes, print it" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "PKG_DONE");
  const again = await world<string[]>(page, "(w)=>w.cases[0].invoices.map(i=>i.id)");
  expect(again).toHaveLength(2);
  expect(again[1]).toBe(inv);
  await expect(card(page).getByRole("button", { name: `Undo the print · ${again[0]}` })).toBeVisible();
});
