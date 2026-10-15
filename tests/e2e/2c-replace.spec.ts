import { expect, test, type Page } from "@playwright/test";

/* Checkpoint 2c — the Replace story. Comments quote the matching sections of the v3 smoke suite
   (docs/Devin Invoice UI/_smoke_journey3.html). */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-13T12:00:00"));
  await page.goto("/");
});

type Vida = { __vida: { ui: { getState(): { openVisit(id: number, mrn: string): void } }; world: { getState(): unknown; setState(fn: (s: never) => void): void } } };
const openVisit = (page: Page, id: number, mrn: string) =>
  page.evaluate(([i, m]) => (globalThis as unknown as Vida).__vida.ui.getState().openVisit(i as number, m as string), [id, mrn]);
const world = <T,>(page: Page, fn: string) =>
  page.evaluate((f) => new Function("w", `return (${f})(w)`)((globalThis as unknown as Vida).__vida.world.getState()), fn) as Promise<T>;
const card = (page: Page) => page.getByTestId("step-card");
const stepNow = (page: Page) => card(page).locator('li[aria-current="step"]');
const payDrawer = (page: Page) => page.getByRole("dialog", { name: /^Payment ·/ });
const refundDrawer = (page: Page) => page.getByRole("dialog", { name: /^Refund ·/ });

/* visit 2: bill and pay the approved orders, then bill the pending one as cash and pay it */
async function cashBilledOrder(page: Page) {
  await openVisit(page, 2, "7000667");
  await page.getByRole("button", { name: "Bill the 3 approved now" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await payDrawer(page).getByRole("button", { name: "Confirm cash payment" }).click();
  await page.getByRole("button", { name: "Bill the 1 pending order(s) as cash now" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await payDrawer(page).getByRole("button", { name: "Confirm cash payment" }).click();
  return world<string>(page, "(w)=>w.cases.find(x=>x.id===2).invoices.find(i=>i.cashOnly).id");
}

test("an insurance patient replaces a cash-billed order once its approval arrives", async ({ page }) => {
  const cashInv = await cashBilledOrder(page);
  /* billed is billed: orders invoicing moves on, and the outstanding approval is the Replace story's */
  await expect(card(page).getByRole("button", { name: /Check approval|Replace/ })).toHaveCount(0);
  await page.getByRole("radio", { name: /^Replace/ }).click();
  await expect(card(page)).toHaveAttribute("data-step", "REPLACE_LIST");
  await expect(card(page).getByTestId("step-q")).toHaveText("Which cash-billed order is moving onto the policy?");
  const row = card(page).locator(`[data-inv="${cashInv}"]`);
  /* before the approval: the Replace story lists the cash invoice, but cannot move it yet */
  await expect(row).toContainText("approval outstanding");
  await expect(row.getByRole("button", { name: "Replace" })).toHaveCount(0);
  await expect(card(page).locator('[data-inv="INV-771204"]')).toHaveCount(0); /* the consultation is not a candidate */
  /* the approval is chased from the Replace story */
  await card(page).getByRole("button", { name: "Check approval" }).click();
  await card(page).getByRole("button", { name: "Check approval" }).click();
  await expect(row.getByRole("button", { name: "Replace" })).toBeVisible();
  await row.getByRole("button", { name: "Replace" }).click();

  /* the replacement is worked in the story card, not a pop-up */
  await expect(card(page)).toHaveAttribute("data-step", "REPLACE_WORK");
  await expect(stepNow(page)).toContainText("Insurer & approvals");
  await expect(card(page).getByTestId("step-q")).toHaveText(`Replace ${cashInv} with an insurance invoice?`);
  await expect(card(page).getByTestId("replace-approvals")).toContainText("Approvals received from BUPA · GOLD for all 1 line(s).");
  await expect(card(page).getByRole("button", { name: "Insurance company" })).toHaveCount(0); /* an insured visit stays on its insurer */
  const diff = (await card(page).getByTestId("replace-diff").textContent())!;
  await card(page).getByRole("button", { name: `Replace · refund ${diff}` }).click();

  /* insurance is cheaper, so the difference goes back in the slide-in */
  const d = refundDrawer(page);
  await expect(stepNow(page)).toContainText("Settle difference");
  await expect(d.getByTestId("refund-box")).toContainText(`${diff} goes back to the patient.`);
  await expect(d.getByTestId("refund-box")).toContainText("Replaced with insurance pricing");
  await d.getByRole("button", { name: "Refund by cash" }).click();
  await expect(d).toHaveCount(0);

  await expect(card(page)).toHaveAttribute("data-step", "STORY_DONE");
  const st = await world<{ replaced: string; fresh: string; billType: string; rfd: number }>(page,
    `(w)=>{const c=w.cases.find(x=>x.id===2);const o=c.invoices.find(i=>i.id==='${cashInv}');const n=c.invoices.find(i=>i.replaces&&i.replaces.includes('${cashInv}'));return {replaced:o.replaced&&o.replaced.newId,fresh:n.id,billType:n.billType,rfd:(c.refundInvoices||[]).length}}`);
  expect(st.replaced).toBe(st.fresh);
  expect(st.billType).toBe("insurance");
  expect(st.rfd).toBe(1);
  await expect(card(page)).toContainText(`Replaced — ${cashInv} → ${st.fresh}`);
  await expect(page.getByTestId("event").first()).toContainText("overpaid before the replacement");
  /* the consultation invoice is untouched */
  expect(await world<boolean>(page, "(w)=>!!w.cases.find(x=>x.id===2).invoices.find(i=>i.id==='INV-771204').replaced")).toBe(false);
});

test("walking away from the refund of a replacement abandons it cleanly", async ({ page }) => {
  const cashInv = await cashBilledOrder(page);
  await page.getByRole("radio", { name: /^Replace/ }).click();
  await card(page).getByRole("button", { name: "Check approval" }).click();
  await card(page).getByRole("button", { name: "Check approval" }).click();
  const before = await world<string>(page, "(w)=>w.cases.find(x=>x.id===2).invoices.map(i=>i.id+':'+(i.replaced?'r':'l')).join('|')");
  await card(page).locator(`[data-inv="${cashInv}"]`).getByRole("button", { name: "Replace" }).click();
  await card(page).getByRole("button", { name: /^Replace · refund/ }).click();
  await refundDrawer(page).getByRole("button", { name: "Cancel" }).click();
  await expect(refundDrawer(page)).toHaveCount(0);
  /* the replacement is abandoned, not left in hand, and nothing changed */
  expect(await world<boolean>(page, "(w)=>!!w.cases.find(x=>x.id===2).bill")).toBe(false);
  expect(await world<string>(page, "(w)=>w.cases.find(x=>x.id===2).invoices.map(i=>i.id+':'+(i.replaced?'r':'l')).join('|')")).toBe(before);
  await expect(page.getByTestId("event").first()).toContainText("Replacement cancelled");
});

test("a cash patient replaces one invoice at a time, asking the insurer in the story card", async ({ page }) => {
  /* visit 1 as a cash visit: WADHA has NCCI and MEDGULF on file */
  await page.evaluate(() => (globalThis as unknown as Vida).__vida.world.setState(((s: { cases: { id: number; payerId: string }[] }) => {
    s.cases.find((x) => x.id === 1)!.payerId = "CASH";
  }) as never));
  await openVisit(page, 1, "7000203");
  await page.getByRole("button", { name: "Yes, bill it" }).click();
  await page.getByRole("button", { name: "Take payment at the desk" }).click();
  await payDrawer(page).getByRole("button", { name: "Confirm cash payment" }).click();
  const inv = await world<string>(page, "(w)=>w.cases.find(x=>x.id===1).invoices[0].id");

  await page.getByRole("radio", { name: /^Replace/ }).click();
  await expect(card(page).getByTestId("step-q")).toHaveText("Which invoice is moving onto insurance?");
  await card(page).locator(`[data-inv="${inv}"]`).getByRole("button", { name: "Replace" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "REPLACE_WORK");
  await expect(card(page)).toContainText("The visit charge moves too");
  await expect(card(page).getByRole("button", { name: / Insurance company$/ })).toContainText("NCCI · CLASS A — 0 of 1 approved");
  /* replace must wait until the line is approved */
  await expect(card(page).getByRole("button", { name: "Waiting on 1 approval(s)" })).toBeDisabled();
  await expect(card(page).getByTestId("replace-diff")).toHaveCount(0);
  await card(page).getByTestId("replace-approvals").getByRole("button", { name: "Check approval" }).click();
  await expect(page.getByText("No answer yet", { exact: true })).toBeVisible();
  await card(page).getByTestId("replace-approvals").getByRole("button", { name: "Check approval" }).click();
  await expect(card(page).getByTestId("replace-approvals")).toContainText("Approvals received from NCCI · CLASS A for all 1 line(s).");
  const go = card(page).getByRole("button", { name: /^Replace · / });
  await expect(go).toBeEnabled();
  await go.click();
  const d = refundDrawer(page);
  await d.getByRole("radio", { name: "Advance wallet" }).click();
  await d.getByRole("button", { name: "Refund by advance wallet" }).click();
  await expect(card(page)).toHaveAttribute("data-step", "STORY_DONE");
  const st = await world<{ payerId: string; billType: string; open: number }>(page,
    "(w)=>{const c=w.cases.find(x=>x.id===1);return {payerId:c.payerId,billType:c.invoices[0].billType,open:w.patients['7000203'].wallet.advance.Open}}");
  /* replacing the visit charge moves the patient type */
  expect(st.payerId).toBe("NCCI-A");
  expect(st.billType).toBe("insurance");
  expect(st.open).toBeGreaterThan(0);
});
