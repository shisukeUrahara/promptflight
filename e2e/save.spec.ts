import { existsSync, rmSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Writes a real file into ./prompts, so it only runs on purpose, against a server that can save:
//   docker compose up -d && E2E_SAVE=1 E2E_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test e2e/save.spec.ts --project desktop
test.skip(!process.env.E2E_SAVE, "set E2E_SAVE=1 to run against a server that can save");

test("saving an edited prompt in the browser writes a new version file to ./prompts", async ({ page }) => {
  await page.goto("/prompts?name=zero-json");
  const editor = page.locator(".monaco-editor").first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "user" }).click();
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(`\n(save test ${Date.now()})`);
  await page.getByRole("button", { name: "Save as new version" }).click();
  const status = page.getByRole("status");
  await expect(status).toHaveText(/Saved as [0-9a-f]{8}\./);
  const id = (await status.textContent())!.match(/[0-9a-f]{8}/)![0];
  const file = `prompts/zero-json/${id}.json`;
  expect(existsSync(file)).toBe(true);
  rmSync(file); // leave the checkout as it was
});
