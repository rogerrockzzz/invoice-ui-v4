import { expect, test, type Page } from "@playwright/test";

/* The profile's payer: clicking it shows its policy in a pop-up; "Change" is a separate button that runs the payer flow. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00"));
  await page.goto("/");
});

const profile = async (page: Page, mrn: string) => {
  await page.getByRole("searchbox", { name: "Find a patient" }).fill(mrn);
  await page.getByRole("button", { name: /^Profile/ }).click();
};

test("clicking the payer shows its policy; Change still changes the payer", async ({ page }) => {
  await profile(page, "7000667");
  await page.getByRole("button", { name: "View the policy of BUPA · GOLD" }).click();
  const pop = page.getByRole("dialog", { name: "Payer Policy" });
  await expect(pop).toBeVisible();
  await expect(pop).toContainText("2288 - BUPA");
  await expect(pop).toContainText("80737 - BUPA CORP");
  await expect(pop).toContainText("RANA AL SHEHRI");
  await expect(pop).toContainText("30-06-2027");
  /* the shares are the plan billing uses */
  await expect(pop.getByTestId("policy-op-share")).toHaveText("20%");
  await expect(pop).toContainText("SAR 200.00");
  await pop.getByRole("button", { name: "Close" }).last().click();
  await expect(pop).toHaveCount(0);

  await page.getByRole("button", { name: "Change the patient's payer" }).click();
  await expect(page.getByText("Checking eligibility with NPHIES…")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Payer Policy" })).toHaveCount(0);
});

type Vida = { __vida: { ui: { getState(): { openVisit(id: number, mrn: string): void } } } };
const openVisit = (page: Page, id: number, mrn: string) =>
  page.evaluate(([i, m]) => (globalThis as unknown as Vida).__vida.ui.getState().openVisit(i as number, m as string), [id, mrn]);

test("on a visit the payer shows its policy too; the arrow opens the Payer story", async ({ page }) => {
  /* visit 1 (WADHA, NCCI · CLASS A) has nothing invoiced yet, so its payer can still change */
  await openVisit(page, 1, "7000203");
  await page.getByRole("button", { name: "View the policy of NCCI · CLASS A" }).click();
  const pop = page.getByRole("dialog", { name: "Payer Policy" });
  await expect(pop).toContainText("1104 - NCCI");
  await expect(pop).toContainText("TAHER");
  await pop.getByRole("button", { name: "Close" }).last().click();
  await expect(pop).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /Payer/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Change who pays for this visit" }).click();
  await expect(page.getByText("Checking eligibility with NPHIES…")).toBeVisible();
});

test("once something is invoiced the payer is locked, but its policy can still be viewed", async ({ page }) => {
  await openVisit(page, 2, "7000667");
  await expect(page.getByRole("button", { name: "The payer is fixed once something has been invoiced" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Change who pays for this visit" })).toHaveCount(0);
  await page.getByRole("button", { name: "View the policy of BUPA · GOLD" }).click();
  await expect(page.getByRole("dialog", { name: "Payer Policy" })).toContainText("2288 - BUPA");
});

test("a self-pay patient has no policy to show", async ({ page }) => {
  await profile(page, "8825140");
  await expect(page.getByTestId("payer-button")).toContainText("no policy on file");
  await expect(page.getByRole("button", { name: /^View the policy of/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Change the patient's payer" })).toBeEnabled();
});

test("in Arabic the policy pop-up reads in Arabic", async ({ page }) => {
  await page.getByRole("radio", { name: "العربية" }).click();
  await page.getByRole("searchbox").fill("7000667");
  await page.getByText("الملف", { exact: true }).click();
  await page.getByRole("button", { name: "عرض وثيقة BUPA · GOLD" }).click();
  const pop = page.getByRole("dialog", { name: "وثيقة الجهة الدافعة" });
  await expect(pop).toContainText("حصة العيادات الخارجية");
  await expect(pop).toContainText("ذهبي");
});
