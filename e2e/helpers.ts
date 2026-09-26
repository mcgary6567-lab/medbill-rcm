import { expect, type Page } from "@playwright/test";

/** The seeded demo administrator of the throwaway end-to-end database (see src/db/seed-data.ts). */
export const DEMO_ADMIN = { email: "admin@collaboratmd.local", password: "admin123" };

export async function signIn(page: Page, who = DEMO_ADMIN) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
