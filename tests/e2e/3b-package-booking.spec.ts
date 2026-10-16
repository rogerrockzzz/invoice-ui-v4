import { expect, test, type Page } from "@playwright/test";

/* Checkpoint 3b — package booking: a paid package's procedures are booked as their own visit, at no charge. */
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

/* visit 2's Cardiac Care Package is billed with the approved orders and paid at the desk */
async function payPackage(page: Page) {
  await openVisit(page, 2, "7000667");
  await page.getByRole("button", { name: "Bill the 3 approved now" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await page.getByRole("dialog", { name: /^Payment ·/ }).getByRole("button", { name: "Confirm cash payment" }).click();
  await expect(page.getByText("4 package procedures ready to book")).toBeVisible();
}

test("the package story suggests the first procedure, books the chosen ones and stays on the visit", async ({ page }) => {
  await payPackage(page);
  await page.getByRole("radio", { name: /^Package booking/ }).click();
  await expect(page.getByRole("radio", { name: /^Package booking/ })).toContainText("4 to book");
  await expect(card(page)).toHaveAttribute("data-step", "PKG_CHOOSE");
  await expect(stepNow(page)).toContainText("Choose procedures");
  await expect(card(page).getByTestId("step-q")).toHaveText("Book a visit for Treadmill Stress Test?");
  await expect(card(page).getByTestId("step-sub")).toHaveText("Treadmill Stress Test · paid inside Cardiac Care Package · no charge.");

  /* the rest are a click away */
  await card(page).getByRole("button", { name: "Choose other procedures · 4 still to book in the package" }).click();
  await expect(card(page).getByTestId("pkg-row")).toHaveCount(4);
  await card(page).getByRole("checkbox", { name: "Book Lipid Profile Recheck" }).dispatchEvent("click");
  await expect(card(page).getByTestId("step-q")).toHaveText("Book a visit for 2 package procedures?");
  await card(page).getByRole("checkbox", { name: "Book Treadmill Stress Test" }).dispatchEvent("click");
  await card(page).getByRole("checkbox", { name: "Book Lipid Profile Recheck" }).dispatchEvent("click");
  await expect(card(page).getByTestId("step-q")).toHaveText("Choose a procedure to book.");
  await expect(card(page).getByRole("button", { name: "Yes, book them" })).toBeDisabled();
  await card(page).getByRole("checkbox", { name: "Book Treadmill Stress Test" }).dispatchEvent("click");
  await card(page).getByRole("checkbox", { name: "Book Lipid Profile Recheck" }).dispatchEvent("click");
  await card(page).getByRole("button", { name: "Yes, book them" }).click();

  await expect(card(page)).toHaveAttribute("data-step", "PKG_WHERE");
  await expect(stepNow(page)).toContainText("Clinic & doctor");
  await expect(card(page).getByTestId("step-q")).toHaveText("Where and with whom?");
  await expect(card(page)).toContainText("Treadmill Stress Test, Lipid Profile Recheck");
  await card(page).getByRole("button", { name: / Clinic$/ }).click();
  await page.getByRole("option", { name: "ENT" }).click();
  await card(page).getByRole("button", { name: "Book the visit" }).click();

  await expect(page.getByText("MOHAMMED AL QAHTANI · 2 package procedure(s) · no charge")).toBeVisible();
  await expect(card(page)).toHaveAttribute("data-step", "STORY_DONE");
  await expect(card(page)).toContainText("Visit booked for 2 package procedure(s)");
  await expect(card(page)).toContainText("Treadmill Stress Test, Lipid Profile Recheck · ENT · Dr AHMED AL SUBAIE · no charge");
  await expect(page.getByTestId("event").first()).toContainText("2 package procedure(s) booked for another day");
  const v = await world<{ visitType: string; clinic: string; orders: { code: string; price: number }[] }>(page,
    "(w)=>{const c=w.cases[0];return {visitType:c.visitType,clinic:c.clinic,orders:c.orders.map(o=>({code:o.code,price:o.price}))}}");
  expect(v).toEqual({ visitType: "Package procedure", clinic: "ENT", orders: [{ code: "PKG-100-A", price: 0 }, { code: "PKG-100-C", price: 0 }] });

  /* the new visit is one click away; it is there only to print the procedure's nil invoice */
  await card(page).getByRole("button", { name: "Open the new visit" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "PKG_PRINT");
  await expect(card(page).getByTestId("step-q")).toHaveText("Print the invoice for 2 package procedure(s)?");
  await expect(page.getByRole("radio", { name: /^Package procedure/ })).toBeChecked();
});

test("the profile books package procedures in a pop-up and opens the new visit", async ({ page }) => {
  await payPackage(page);
  await openPatient(page, "7000667");
  const box = page.getByRole("button", { name: /^Package procedures/ });
  await expect(box).toContainText("4 of 4 still to be booked");
  await box.click();
  await page.getByRole("row", { name: /Echocardiogram Review/ }).getByRole("button", { name: "Book a visit" }).click();
  const pop = page.getByRole("dialog", { name: "Book a visit for package procedures" });
  await expect(pop).toContainText("MOHAMMED AL QAHTANI · MRN 7000667 · paid inside a package, so the visit is raised at no charge");
  await expect(pop.getByRole("checkbox", { name: "Book Echocardiogram Review" })).toBeChecked();
  await expect(pop.getByRole("button", { name: "Create the visit · 1 procedure(s)" })).toBeEnabled();
  await pop.getByRole("checkbox", { name: "Book Cardiology Follow-up Review" }).dispatchEvent("click");
  await pop.getByRole("button", { name: "Create the visit · 2 procedure(s)" }).click();

  await expect(card(page)).toHaveAttribute("data-step", "PKG_PRINT");
  await expect(page.getByText("MOHAMMED AL QAHTANI · 2 package procedure(s) · no charge")).toBeVisible();

  /* back on the profile, the booked procedures link to their visit and are no longer offered */
  await openPatient(page, "7000667");
  await expect(box).toContainText("2 of 4 still to be booked");
  await expect(page.getByRole("row", { name: /Echocardiogram Review/ }).getByRole("button", { name: "Open visit" })).toBeVisible();
  await page.getByRole("button", { name: "book a visit ›" }).click();
  await expect(pop.getByTestId("pkg-row")).toHaveCount(2);
  await expect(pop).toContainText("2 procedure(s) already have a visit booked and are not shown.");
  await expect(pop.getByRole("button", { name: "Create the visit · 0 procedure(s)" })).toBeDisabled();
  await pop.getByRole("button", { name: "Cancel" }).click();
  await expect(pop).toHaveCount(0);
  await page.getByRole("row", { name: /Echocardiogram Review/ }).getByRole("button", { name: "Open visit" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "PKG_PRINT");
});
