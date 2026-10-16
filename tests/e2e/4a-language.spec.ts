import { expect, test } from "@playwright/test";

/* Milestone 4 — Arabic / RTL: the header switch flips the language and the layout, and is remembered. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00"));
  await page.goto("/");
});

type Vida = { __vida: { ui: { getState(): { openVisit(id: number, mrn: string): void } } } };

test("the header switch turns the app to Arabic, right to left, and back", async ({ page }) => {
  const html = page.locator("html");
  await expect(html).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("radio", { name: "English" })).toBeChecked();

  await page.getByRole("radio", { name: "العربية" }).click();
  await expect(html).toHaveAttribute("lang", "ar");
  await expect(html).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("ابحث عن مريض للبدء")).toBeVisible();
  /* data values (names, MRN) and Western-digit amounts stay as they are */
  await page.getByRole("searchbox", { name: "البحث عن مريض" }).fill("7000667");
  await expect(page.getByTestId("patient-7000667")).toContainText("MOHAMMED AL QAHTANI");

  /* the layout mirrors: the search label sits at the inline start, now on the right */
  const label = await page.getByText("البحث عن مريض", { exact: true }).boundingBox();
  expect(label!.x).toBeGreaterThan(page.viewportSize()!.width / 2);

  /* remembered across a reload */
  await page.reload();
  await expect(html).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("radio", { name: "العربية" })).toBeChecked();

  await page.getByRole("radio", { name: "English" }).click();
  await expect(html).toHaveAttribute("dir", "ltr");
  await expect(page.getByText("Search for a patient to begin")).toBeVisible();
});

test("in Arabic the visit's step reads in Arabic and the payment drawer opens from the inline end", async ({ page }) => {
  await page.getByRole("radio", { name: "العربية" }).click();
  await page.evaluate(() => (globalThis as unknown as Vida).__vida.ui.getState().openVisit(2, "7000667"));
  await expect(page.getByTestId("step-q")).toHaveText("طُلب 4 إجراءات. 3 لديها موافقة، و1 ليست لديها.");
  await expect(page.getByTestId("step-amt")).toContainText("SAR 273.69");

  await page.getByRole("button", { name: "فوترة الـ 3 الموافق عليها الآن" }).click();
  await page.getByRole("button", { name: "استلام الدفع في الكاونتر" }).click();
  await expect(page.getByRole("dialog", { name: /^الدفع ·/ })).toBeVisible();
  /* both projects are wider than 768px, so it is a side drawer — on the left in RTL */
  await expect.poll(async () => (await page.getByTestId("drawer").boundingBox())!.x).toBeLessThan(10);
});
