import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a patient opens their portal link with their date of birth", async ({ page }) => {
  await signIn(page);
  await page.goto("/patients");
  // A patient row's link (an id), not "New patient" or other tools.
  await page.locator("table a[href^='/patients/']").first().click();
  await expect(page).toHaveURL(/\/patients\/[0-9a-f-]{36}/);
  const dob = (await page.getByText(/DOB /).first().textContent())!.match(/DOB (\w{3} \d{1,2}, \d{4})/)![1];
  await page.getByRole("button", { name: "Send portal link" }).click();
  const field = page.locator('input[readonly][value*="/portal/"]');
  await expect(field).toBeVisible();
  // The link is built from the site's public address; open the same path on this test server.
  const path = new URL(await field.inputValue()).pathname;

  // The patient's side, in a fresh browser context with no staff session.
  const patient = await page.context().browser()!.newContext();
  const p = await patient.newPage();
  await p.goto(new URL(path, page.url()).toString());
  const d = new Date(`${dob} 12:00`);
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await p.locator('input[name="dob"]').fill(iso);
  await p.getByRole("button", { name: /Continue/ }).click();
  await expect(p.getByText(/balance/i).first()).toBeVisible();
  await patient.close();
});

/** Serious and critical WCAG 2.1 A/AA problems on the main screens. */
for (const path of ["/login", "/dashboard", "/claims", "/patients", "/settings", "/billing"]) {
  test(`accessibility: ${path}`, async ({ page }) => {
    if (path !== "/login") await signIn(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  });
}
