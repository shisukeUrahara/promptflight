import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const root = "e2e/fixtures/data/experiments";
const runs = readdirSync(root).sort();
const holdout = runs.find((r) => r.endsWith("-holdout"))!;
const tuning = runs.find((r) => r.endsWith("-tuning"))!;
const scores = (id: string) => JSON.parse(readFileSync(`${root}/${id}/scores.json`, "utf8"));

test("shows the newest holdout run by default, one card per variant", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Run", { exact: true })).toHaveValue(holdout);
  for (const v of scores(holdout).variants) {
    await expect(page.getByTestId(`acc-${v.variant}`)).toHaveText(v.accuracy.toFixed(3));
  }
});

test("picking another run reloads with its numbers", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Run", { exact: true }).selectOption(tuning);
  await expect(page).toHaveURL(new RegExp(`run=${tuning}`));
  const v = scores(tuning).variants[0];
  await expect(page.getByTestId(`acc-${v.variant}`)).toHaveText(v.accuracy.toFixed(3));
});

test("an unknown run id falls back to the default run", async ({ page }) => {
  await page.goto("/?run=does-not-exist");
  await expect(page.getByLabel("Run", { exact: true })).toHaveValue(holdout);
});
