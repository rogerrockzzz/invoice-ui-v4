import { expect, test, type Page } from "@playwright/test";

/* Checkpoint 1a — shell, home, patient profile, tabs. Test names quote the matching sections of the v3
   smoke suite (docs/Devin Invoice UI/_smoke_journey3.html). The clock is frozen so "Today" and the
   booked visits (+2 / +6 days) are stable. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00"));
  await page.goto("/");
});

const search = (page: Page, q: string) => page.getByRole("searchbox", { name: "Find a patient" }).fill(q);
const patientRow = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(name) });

test("nothing is loaded until you search", async ({ page }) => {
  await expect(page.getByText("Search for a patient to begin")).toBeVisible();
  await expect(page.getByTestId(/^patient-/)).toHaveCount(0);
});

test("a patient is found by name, MRN, mobile or doctor — with or without the Dr", async ({ page }) => {
  for (const q of ["qahtani", "7000667", "0555112233", "0555 112 233", "subaie", "dr subaie", "Dr. Subaie"]) {
    await search(page, q);
    await expect(page.getByTestId("patient-7000667"), q).toBeVisible();
  }
  /* found through the doctor: labelled with the doctor and counted as such */
  await search(page, "subaie");
  await expect(page.getByTestId("patient-7000667").getByText("Dr AHMED AL SUBAIE")).toBeVisible();
  await expect(page.getByTestId("result-count")).toHaveText("1 · 1 by doctor");
  await search(page, "nobody-like-this");
  await expect(page.getByText("No patient matches “nobody-like-this”.")).toBeVisible();
});

test("choosing the patient offers two cards, and loads nothing else", async ({ page }) => {
  await search(page, "qahtani");
  const card = page.getByTestId("patient-7000667");
  await expect(card.getByRole("button", { name: /Today's pending actions/ })).toHaveCount(0);
  await patientRow(page, "MOHAMMED AL QAHTANI").click();
  await expect(card.getByRole("button", { name: /Today's pending actions/ })).toBeVisible();
  await expect(card.getByRole("button", { name: /Walk-in visit/ })).toBeVisible();
  await expect(card.getByTestId(/^tile-/)).toHaveCount(0);
  /* the pending card opens the day's work: to do first */
  await card.getByRole("button", { name: /Today's pending actions/ }).click();
  await expect(card.getByTestId(/^tile-/)).toHaveCount(2);
  await expect(card.getByTestId("tile-2")).toContainText("SAR 273.69");
  /* the card closes again; the patient row closes everything */
  await card.getByRole("button", { name: /Today's pending actions/ }).click();
  await expect(card.getByTestId(/^tile-/)).toHaveCount(0);
  await patientRow(page, "MOHAMMED AL QAHTANI").click();
  await expect(card.getByRole("button", { name: /Today's pending actions/ })).toHaveCount(0);
});

test("the profile shows the wallet, the payer in force, and every visit", async ({ page }) => {
  await search(page, "7000667");
  await page.getByRole("button", { name: /^Profile/ }).click();
  await expect(page.getByRole("heading", { name: "MOHAMMED AL QAHTANI" })).toBeVisible();
  await expect(page.getByTestId("wallet-advance")).toHaveText("SAR 500.00");
  await expect(page.getByTestId("wallet-credit")).toHaveText("SAR 300.00");
  await expect(page.getByTestId("visits-on-file")).toHaveText("5");
  await expect(page.getByText("Active payer · from the open visit Today 11:05")).toBeVisible();
  await expect(page.getByTestId("payer-button")).toContainText("BUPA · GOLD");
  await expect(page.getByTestId("payer-button")).toContainText("deductible 20% · cap SAR 200.00 · 5% discount");
  await expect(page.getByText("3 payers on file")).toBeVisible();

  const rows = page.getByTestId(/^visit-row-/);
  await expect(rows).toHaveCount(5);
  await expect(rows.nth(0)).toContainText("V100030");
  await expect(rows.nth(0)).toContainText("15 Oct 10:30");
  await expect(rows.nth(0)).toContainText("Upcoming");
  await expect(rows.nth(1)).toContainText("V100020");
  await expect(rows.nth(1)).toContainText("Action needed");
  await expect(rows.nth(2)).toContainText("4 procedures were ordered. 3 have approval, 1 does not.");
  await expect(rows.nth(3)).toContainText("Collected SAR 65.55");
  await expect(rows.nth(4)).toContainText("Closed");
  await expect(page.getByTestId("patient-invoices")).toContainText("7 on file incl. 3 advance / credit · SAR 131.10 collected · SAR 300.00 on credit");
});

test("booked visits come first, flagged upcoming, then today's — upcoming and past a tab away", async ({ page }) => {
  await search(page, "qahtani");
  await page.getByRole("button", { name: /^Profile/ }).click();
  const tabs = page.getByRole("tablist", { name: "Pending actions" });
  await expect(tabs.getByRole("tab", { name: /Today/ })).toContainText("2");
  await expect(tabs.getByRole("tab", { name: /Upcoming/ })).toContainText("1");
  await expect(tabs.getByRole("tab", { name: /Past/ })).toContainText("0");
  await expect(page.getByTestId("tile-20")).toContainText("Next: Bill orders");
  /* upcoming */
  await tabs.getByRole("tab", { name: /Upcoming/ }).click();
  await expect(page.getByTestId("tile-30")).toContainText("Upcoming");
  await expect(page.getByTestId("tile-30")).toContainText("Next: Consultation approval");
  /* past */
  await tabs.getByRole("tab", { name: /Past/ }).click();
  await expect(page.getByText("No earlier visit is still waiting on anything.")).toBeVisible();
  /* the choice holds, and a tile still opens its visit */
  await tabs.getByRole("tab", { name: /Today/ }).click();
  await page.getByTestId("tile-2").getByRole("button", { name: /Open/ }).click();
  await expect(page.getByText("V100002 · Consultation · CARDIOLOGY")).toBeVisible();
  /* back to the patient */
  await page.getByRole("link", { name: "MOHAMMED AL QAHTANI" }).click();
  await expect(page.getByRole("heading", { name: "MOHAMMED AL QAHTANI" })).toBeVisible();
  /* and back to the homepage */
  await page.getByRole("link", { name: "Home" }).click();
  await expect(page.getByRole("searchbox", { name: "Find a patient" })).toHaveValue("qahtani");
});

test("visits can be filtered by number and paired with their follow-ups", async ({ page }) => {
  await search(page, "7000203");
  await page.getByRole("button", { name: /^Profile/ }).click();
  await page.getByRole("textbox", { name: "Visit no." }).fill("v100013");
  await expect(page.getByTestId(/^visit-row-/)).toHaveCount(1);
  await expect(page.getByText("1 of 5 · newest first")).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByTestId(/^visit-row-/)).toHaveCount(5);
  await page.getByText("Pair related visits").click();
  await expect(page.getByTestId("visit-row-13")).toContainText("Follow-up of V100012");
  await expect(page.getByTestId("visit-row-12")).toContainText("1 related");
});

test("switching tabs moves between patients without losing the others, and one can be closed", async ({ page }) => {
  for (const q of ["7000667", "7000203", "7100482"]) {
    await search(page, q);
    await page.getByRole("button", { name: /^Profile/ }).click();
    await page.getByRole("button", { name: "Home", exact: true }).click();
  }
  const nav = page.getByRole("navigation", { name: "Open patients" });
  await expect(nav.getByRole("button", { name: /^MOHAMMED AL/ })).toBeVisible();
  await expect(nav.getByRole("button", { name: /^WADHA DAIFALLAH/ })).toBeVisible();
  await expect(nav.getByRole("button", { name: /^NOURA AL/ })).toBeVisible();
  await search(page, "");
  await expect(page.getByText("You have 3 patient(s) open in the tabs above.")).toBeVisible();

  await nav.getByRole("button", { name: /^WADHA DAIFALLAH/ }).click();
  await expect(page.getByRole("heading", { name: "WADHA DAIFALLAH" })).toBeVisible();
  await nav.getByRole("button", { name: /^MOHAMMED AL/ }).click();
  await expect(page.getByRole("heading", { name: "MOHAMMED AL QAHTANI" })).toBeVisible();
  /* and one can be closed */
  await nav.getByRole("button", { name: "Close WADHA DAIFALLAH" }).click();
  await expect(nav.getByRole("button", { name: /^WADHA DAIFALLAH/ })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: /^MOHAMMED AL/ })).toBeVisible();
  await expect(nav.getByRole("button", { name: /^NOURA AL/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "MOHAMMED AL QAHTANI" })).toBeVisible();
});

test("the theme can be switched and is remembered", async ({ page }) => {
  await page.getByRole("button", { name: "Branch settings" }).click();
  await page.getByRole("menuitem", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("changing the hospital says so", async ({ page }) => {
  await page.getByRole("button", { name: /AL Hamra Hospital/ }).click();
  await page.getByRole("option", { name: "Qassim Hospital" }).click();
  await expect(page.getByText("Now working at Qassim Hospital.")).toBeVisible();
});
