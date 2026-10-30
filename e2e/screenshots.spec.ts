import { expect, test } from "@playwright/test";

// Captures the README images from a server that reads the REAL data folder (not the e2e fixture):
//   pnpm build && PF_READONLY=1 pnpm start --port 3200 &
//   E2E_SHOTS=1 E2E_BASE_URL=http://localhost:3200 pnpm exec playwright test e2e/screenshots.spec.ts --project desktop --project mobile
test.skip(!process.env.E2E_SHOTS, "set E2E_SHOTS=1 to capture README images");

const HOLDOUT = "20261030T122450Z-holdout";

test("desktop images", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`/?run=${HOLDOUT}`);
  await page.screenshot({ path: "docs/img/experiments.png", fullPage: true });
  await page.goto(`/?run=${HOLDOUT}&metric=priority`);
  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: "docs/img/experiments-priority-dark.png" });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(`/cases?run=${HOLDOUT}&allwrong=1&case=t-159`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: "docs/img/case-dialog.png" });
  await page.goto("/prompts?name=few-strict");
  await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "docs/img/prompts.png" });
});

test("phone image", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto(`/?run=${HOLDOUT}`);
  await page.screenshot({ path: "docs/img/experiments-phone.png" });
});
