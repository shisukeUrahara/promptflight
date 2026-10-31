import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const root = "e2e/fixtures/data/experiments";
const holdout = readdirSync(root).find((r) => r.endsWith("-holdout"))!;
const scores = JSON.parse(readFileSync(`${root}/${holdout}/scores.json`, "utf8"));

test("the Overview explains the test and shows every prompt's accuracy", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Which prompt sorts\s*support tickets best\?/);
  await expect(page.getByText(`${scores.variants.length} prompts. ${scores.n_cases} frozen tickets.`)).toBeVisible();
  for (const v of scores.variants) {
    await expect(page.getByTestId(`prompt-${v.variant}`)).toContainText((v.accuracy * 100).toFixed(1));
  }
  const best = scores.variants.reduce((a: { accuracy: number }, b: { accuracy: number }) => (b.accuracy > a.accuracy ? b : a));
  await expect(page.getByTestId(`prompt-${best.variant}`)).toContainText("Highest");
});

test("the verdict, the flow diagram, the findings and the facts are there", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Verdict" })).toContainText(/prompt wins/);
  await expect(page.getByRole("region", { name: "How it works" })).toContainText("Checker");
  await expect(page.getByRole("region", { name: "What we found" }).getByRole("link", { name: "View tickets ›" })).toHaveCount(3);
  await expect(page.getByRole("region", { name: "Facts" })).toContainText("valid answers");
});

test("the Risk card lands on the injection tickets", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("region", { name: "What we found" }).getByRole("link", { name: "View tickets ›" }).first().click();
  await expect(page).toHaveURL(/\/cases\?run=.+&slice=injection/);
  await expect(page.getByRole("heading", { level: 1, name: "Tickets" })).toBeVisible();
});

test("a model chip switches the run", async ({ page }) => {
  await page.goto("/");
  const chip = page.getByRole("navigation", { name: "Model" }).getByRole("link").first();
  await expect(chip).toHaveAttribute("aria-current", "true");
  await expect(chip).toHaveAttribute("href", `/?run=${holdout}`);
});
