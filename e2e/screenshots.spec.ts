import { expect, test } from "@playwright/test";

// Captures the README images from a server that reads the REAL data folder (not the e2e fixture):
//   pnpm build && PF_READONLY=1 pnpm start --port 3200 &
//   E2E_SHOTS=1 E2E_BASE_URL=http://localhost:3200 pnpm exec playwright test e2e/screenshots.spec.ts --project desktop --project mobile
test.skip(!process.env.E2E_SHOTS, "set E2E_SHOTS=1 to capture README images");

const HOLDOUT = "20261030T122723Z-holdout"; // gpt-4o-mini, the run the Overview opens on

test("desktop images", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop only");
  // The fade-up animation would otherwise catch cards half-faded.
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(`/?run=${HOLDOUT}`);
  await page.screenshot({ path: "docs/img/overview.png", fullPage: true });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.screenshot({ path: "docs/img/overview-dark.png" });
  await page.goto(`/results?run=${HOLDOUT}`);
  await page.screenshot({ path: "docs/img/results-dark.png", fullPage: true });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(`/results?run=${HOLDOUT}`);
  await page.getByRole("region", { name: "Pre-registered comparisons" }).screenshot({ path: "docs/img/results-comparisons.png" });
  await page.goto(`/cases?run=${HOLDOUT}&allwrong=1&case=t-159`);
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: "docs/img/case-dialog.png" });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/prompts?name=few-strict");
  await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "docs/img/prompts.png" });
});

test("phone images", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto(`/?run=${HOLDOUT}`);
  await page.screenshot({ path: "docs/img/overview-phone.png" });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto(`/cases?run=${HOLDOUT}`);
  await page.screenshot({ path: "docs/img/tickets-phone.png" });
});
