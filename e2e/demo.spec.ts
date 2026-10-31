import { expect, test } from "@playwright/test";

// Records the demo video from a server that reads the REAL data folder:
//   pnpm build && PF_READONLY=1 pnpm start --port 3200 &
//   E2E_DEMO=1 E2E_BASE_URL=http://localhost:3200 pnpm exec playwright test e2e/demo.spec.ts --project desktop
// The video lands in test-results/; copy it where you need it.
test.skip(!process.env.E2E_DEMO, "set E2E_DEMO=1 to record the demo video");
test.use({ viewport: { width: 1440, height: 900 }, video: { mode: "on", size: { width: 1440, height: 900 } } });

const HOLDOUT = "20261030T122723Z-holdout";

test("demo: overview, results, a comparison, a ticket, prompts", async ({ page }) => {
  test.setTimeout(120_000);
  const scroll = async (px: number, steps = 12) => {
    for (let i = 0; i < steps; i++) {
      await page.mouse.wheel(0, px / steps);
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(900);
  };
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto(`/?run=${HOLDOUT}`);
  await page.waitForTimeout(2500);
  await scroll(700);
  await scroll(700);
  await scroll(800);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Results" }).click();
  await expect(page).toHaveURL(/\/results/);
  await page.waitForTimeout(2000);
  await scroll(650);
  await page.waitForTimeout(1500);
  await page.getByTestId("contrast-H1").getByRole("link", { name: "View tickets ›" }).click();
  await expect(page).toHaveURL(/disagree=1/);
  await page.waitForTimeout(1500);
  await page.getByRole("link", { name: /^t-\d+$/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(3500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Prompts" }).click();
  await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await page.waitForTimeout(2000);
});
