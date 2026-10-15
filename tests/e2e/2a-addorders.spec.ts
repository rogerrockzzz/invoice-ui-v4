import { expect, test, type Page } from "@playwright/test";

/* Checkpoint 2a — the Add orders story: reception adds tests and packages that need no doctor. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00"));
  await page.goto("/");
});

type Vida = { __vida: { ui: { getState(): { openVisit(id: number, mrn: string): void } }; world: { getState(): unknown } } };
const openVisit = (page: Page, id: number, mrn: string) =>
  page.evaluate(([i, m]) => (globalThis as unknown as Vida).__vida.ui.getState().openVisit(i as number, m as string), [id, mrn]);
const world = <T,>(page: Page, fn: string) =>
  page.evaluate((f) => new Function("w", `return (${f})(w)`)((globalThis as unknown as Vida).__vida.world.getState()), fn) as Promise<T>;
const card = (page: Page) => page.getByTestId("step-card");
const stepNow = (page: Page) => card(page).locator('li[aria-current="step"]');

test("add orders: choose, review, add — they go straight to Orders invoicing", async ({ page }) => {
  await openVisit(page, 4, "8825140");
  await page.getByRole("radio", { name: /^Add orders/ }).click();
  await expect(card(page)).toHaveAttribute("data-step", "ADD_CHOOSE");
  await expect(stepNow(page)).toContainText("Choose orders");
  await expect(card(page).getByTestId("step-q")).toHaveText("What does AHMED need?");
  const next = card(page).getByRole("button", { name: /^Next · review/ });
  await expect(next).toBeDisabled();
  /* what needs a doctor is shown when searched, but cannot be picked here */
  await card(page).getByRole("searchbox").fill("mri");
  await expect(card(page).getByRole("button", { name: /^MRI Brain/ })).toBeDisabled();
  await card(page).getByRole("searchbox").fill("");
  await card(page).getByRole("button", { name: /^Vitamin D Total/ }).click();
  await card(page).getByRole("searchbox").fill("lipid");
  await card(page).getByRole("button", { name: /^Lipid Profile/ }).click();
  await expect(next).toHaveText("Next · review (2 · SAR 345.00)");
  await next.click();

  await expect(card(page)).toHaveAttribute("data-step", "ADD_REVIEW");
  await expect(stepNow(page)).toContainText("Review");
  await expect(card(page).getByTestId("step-q")).toHaveText("Add 2 order(s) to the visit?");
  await expect(card(page).getByTestId("add-review")).toContainText("Vitamin D Total");
  await expect(card(page).getByTestId("step-amt")).toContainText("SAR 345.00");
  await expect(card(page)).toContainText("They go straight to Orders invoicing to be billed.");
  /* "change" goes back with the cart kept */
  await card(page).getByRole("link", { name: "change" }).click();
  await expect(card(page).getByRole("button", { name: /^Next · review \(2/ })).toBeVisible();
  await card(page).getByRole("button", { name: /^Next · review/ }).click();
  await card(page).getByRole("button", { name: "Add 2 order(s)" }).click();

  await expect(card(page)).toHaveAttribute("data-step", "STORY_DONE");
  await expect(card(page)).toContainText("2 order(s) added");
  await expect(card(page)).toContainText("Vitamin D Total, Lipid Profile · SAR 345.00 at the cash price");
  await expect(page.getByRole("radio", { name: /^Add orders/ })).toContainText("2 order(s) added");
  const added = await world<{ code: string; byReception: boolean; ins: string }[]>(page,
    "(w)=>w.cases.find(c=>c.id===4).orders.filter(o=>o.byReception).map(o=>({code:o.code,byReception:o.byReception,ins:o.ins}))");
  expect(added).toEqual([{ code: "LAB-VITD", byReception: true, ins: "notinsured" }, { code: "LAB-LIPID", byReception: true, ins: "notinsured" }]);
  await expect(page.getByTestId("event").first()).toContainText("2 order(s) added at reception");

  /* more can always be added; and the orders story now bills them */
  await card(page).getByRole("button", { name: "Add more orders" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "ADD_CHOOSE");
  await page.getByRole("radio", { name: /^Orders invoicing/ }).click();
  await expect(card(page)).toHaveAttribute("data-step", "ORDERS_BILL");
  await expect(card(page).getByTestId("step-amt")).toContainText("SAR 345.00");
  await expect(page.getByRole("radio", { name: /^Add orders/ })).toContainText("2 added");
});

test("a procedure-only visit with nothing ordered offers Add orders", async ({ page }) => {
  await page.evaluate(() => {
    const v = (globalThis as unknown as { __vida: { world: { setState(fn: (s: { cases: { id: number; visitType: string; consult: { price: number }; orders: unknown[] }[] }) => void): void } } }).__vida.world;
    v.setState((s) => { const c = s.cases.find((x) => x.id === 4)!; c.visitType = "Procedure only"; c.orders = []; });
  });
  await openVisit(page, 4, "8825140");
  await expect(card(page)).toHaveAttribute("data-step", "NO_ORDERS");
  await card(page).getByRole("button", { name: "Add orders" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "ADD_CHOOSE");
  await expect(page.getByRole("radio", { name: /^Add orders/ })).toBeChecked();
});
