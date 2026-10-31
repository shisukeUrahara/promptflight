import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const root = "e2e/fixtures/data/experiments";
const runs = readdirSync(root).sort();
const holdout = runs.find((r) => r.endsWith("-holdout"))!;
const tuning = runs.find((r) => r.endsWith("-tuning"))!;
const scores = (id: string) => JSON.parse(readFileSync(`${root}/${id}/scores.json`, "utf8"));

test("shows the newest holdout run by default, one card per variant", async ({ page }) => {
  await page.goto("/results");
  await expect(page.getByLabel("All runs")).toHaveValue(holdout);
  for (const v of scores(holdout).variants) {
    await expect(page.getByTestId(`acc-${v.variant}`)).toHaveText(`${(v.accuracy * 100).toFixed(1)}%`);
  }
});

test("picking another run reloads with its numbers", async ({ page }) => {
  await page.goto("/results");
  await page.getByLabel("All runs").selectOption(tuning);
  await expect(page).toHaveURL(new RegExp(`run=${tuning}`));
  const v = scores(tuning).variants[0];
  await expect(page.getByTestId(`acc-${v.variant}`)).toHaveText(`${(v.accuracy * 100).toFixed(1)}%`);
});

test("an unknown run id falls back to the default run", async ({ page }) => {
  await page.goto("/results?run=does-not-exist");
  await expect(page.getByLabel("All runs")).toHaveValue(holdout);
});

test("the metric switch shows the priority family", async ({ page }) => {
  await page.goto("/results");
  await expect(page.getByTestId("contrast-H1")).toBeVisible();
  await page.getByRole("link", { name: "Priority · secondary" }).click();
  await expect(page).toHaveURL(/metric=priority/);
  await expect(page.getByTestId("contrast-H5")).toBeVisible();
  await expect(page.getByTestId("contrast-H1")).toHaveCount(0);
});

test("a confusion-matrix cell links to its tickets", async ({ page }) => {
  await page.goto("/results");
  const cell = page.getByRole("link", { name: /tickets with gold/ }).first();
  await expect(cell).toHaveAttribute("href", /^\/cases\?run=.+&variant=.+&gold=.+&pred=.+$/);
});

test("the manifest downloads as JSON; a bad run id is a 404", async ({ request }) => {
  const ok = await request.get(`/runs/${holdout}/manifest`);
  expect(ok.status()).toBe(200);
  expect(ok.headers()["content-disposition"]).toContain("attachment");
  expect((await ok.json()).run_id).toBe(holdout);
  expect((await request.get("/runs/..%2F..%2Fetc/manifest")).status()).toBe(404);
  expect((await request.get("/runs/nope/manifest")).status()).toBe(404);
});
