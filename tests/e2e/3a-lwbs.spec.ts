import { expect, test, type Page } from "@playwright/test";

/* Checkpoint 3a — left without being seen. Comments quote the matching section of the v3 smoke suite
   (docs/Devin Invoice UI/_smoke_journey3.html, "a patient who leaves before being seen is marked LWBS"). */
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
const pop = (page: Page) => page.getByRole("dialog", { name: /left without being seen\?$/ });

test("paid → see the doctor → LWBS (Waited too long) → undone", async ({ page }) => {
  await openVisit(page, 1, "7000203");
  await page.getByRole("button", { name: "Yes, bill it" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await page.getByRole("dialog", { name: /^Payment ·/ }).getByRole("button", { name: "Confirm cash payment" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "SEE_DOCTOR");
  await expect(stepNow(page)).toContainText("See the doctor");

  /* the LWBS confirmation opens; "Keep waiting" leaves the visit as it was */
  await card(page).getByRole("button", { name: "Left without being seen" }).click();
  await expect(pop(page).getByRole("heading")).toHaveText("Mark WADHA as left without being seen?");
  await expect(pop(page)).toContainText("WADHA DAIFALLAH · Consultation · PAEDIATRICS — the doctor had not started the consultation.");
  await expect(pop(page)).toContainText("The consultation stays paid. If the money goes back, use the Refund story.");
  await pop(page).getByRole("button", { name: "Keep waiting" }).click();
  await expect(pop(page)).toHaveCount(0);
  await expect(card(page)).toHaveAttribute("data-step", "SEE_DOCTOR");

  await card(page).getByRole("button", { name: "Left without being seen" }).click();
  await pop(page).getByRole("radio", { name: "Waited too long" }).click();
  await pop(page).getByRole("button", { name: "Mark as LWBS" }).click();
  await expect(page.getByText("Marked LWBS")).toBeVisible();
  await expect(card(page)).toHaveAttribute("data-step", "LWBS");
  await expect(card(page).getByTestId("step-q")).toHaveText("WADHA left without being seen.");
  /* it should point to the refund for the paid consultation */
  await expect(card(page).getByTestId("step-sub")).toContainText("Waited too long. The consultation is still paid — refund it from the Refund story if needed.");
  await expect(page.getByRole("radio", { name: /^Visit invoicing/ })).toContainText("Left without being seen");
  /* the orders story stays locked, and nothing more can be added */
  await expect(page.getByRole("radio", { name: /^Add orders/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /^Orders invoicing/ }).click();
  await expect(page.getByText("The patient left without being seen").first()).toBeVisible();
  await expect(page.getByTestId("event").first()).toContainText("Left without being seen");
  const h = await world<{ type: string; sub: string; reason: string }>(page, "(w)=>w.cases.find(c=>c.id===1).history[0]");
  expect(h).toMatchObject({ type: "LWBS", sub: "Waited too long · the doctor had not started", reason: "Waited too long" });

  /* the visit list should show LWBS */
  await openPatient(page, "7000203");
  await expect(page.getByTestId("visit-row-1")).toContainText("LWBS");

  /* a mistake can be undone */
  await openVisit(page, 1, "7000203");
  await card(page).getByRole("button", { name: "The patient came back — undo" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "SEE_DOCTOR");
  await expect(page.getByTestId("event").first()).toContainText("LWBS cleared");
  await expect(page.getByRole("radio", { name: /^Add orders/ })).toHaveCount(1);
});

test("no reason given is recorded as such", async ({ page }) => {
  await page.evaluate(() => {
    const v = (globalThis as unknown as { __vida: { world: { setState(fn: (s: { cases: { id: number; consult: { paid: boolean } }[] }) => void): void } } }).__vida.world;
    v.setState((s) => { s.cases.find((x) => x.id === 1)!.consult.paid = true; });
  });
  await openVisit(page, 1, "7000203");
  await card(page).getByRole("button", { name: "Left without being seen" }).click();
  /* nothing was paid on this visit, so there is nothing to refund */
  await expect(pop(page)).not.toContainText("Refund story");
  await pop(page).getByRole("button", { name: "Mark as LWBS" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "LWBS");
  await expect(page.getByTestId("event").first()).toContainText("No reason given · the doctor had not started");
});
