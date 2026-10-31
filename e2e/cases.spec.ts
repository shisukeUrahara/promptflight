import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const root = "e2e/fixtures/data/experiments";
const holdout = readdirSync(root).find((r) => r.endsWith("-holdout"))!;
const results = readFileSync(`${root}/${holdout}/per_case_results.jsonl`, "utf8").trim().split("\n").map((l) => JSON.parse(l));
const ticketCount = new Set(results.map((r) => r.case_id)).size;

test("lists the default run's tickets, 15 per page", async ({ page }) => {
  await page.goto("/cases");
  await expect(page.getByText(`Showing 1–15 of ${ticketCount} tickets`)).toBeVisible();
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText(`Showing 16–${Math.min(30, ticketCount)} of ${ticketCount} tickets`)).toBeVisible();
});

test("search by ticket id finds that one ticket", async ({ page }) => {
  const id = results[0].case_id;
  await page.goto(`/cases?q=${id.toUpperCase()}`);
  await expect(page.getByText(/Showing 1–1 of 1 ticket/)).toBeVisible();
  await expect(page.getByText(id, { exact: true }).first()).toBeVisible();
});

test("the disagreement chip filters through the URL", async ({ page }) => {
  await page.goto("/cases");
  await page.getByRole("link", { name: /^Only disagreements/ }).click();
  await expect(page).toHaveURL(/disagree=1/);
  const shown = await page.getByText(/Showing \d+–\d+ of \d+ tickets/).textContent();
  expect(Number(shown!.match(/of (\d+)/)![1])).toBeLessThan(ticketCount);
});

test("a failure-code link shows only tickets with that code", async ({ page }) => {
  const failing = results.filter((r) => r.code === "invalid_json");
  test.skip(failing.length === 0, "fixture has no invalid_json");
  await page.goto(`/cases?run=${holdout}&failure=invalid_json`);
  const ids = new Set(failing.map((r) => r.case_id));
  await expect(page.getByText(`of ${ids.size} tickets`)).toBeVisible();
});

test("a ticket opens in a dialog with the raw answers; Esc closes it and focus returns", async ({ page }) => {
  await page.goto("/cases");
  const first = page.getByRole("row").nth(1).getByRole("link").first();
  const id = (await first.textContent())!.trim();
  await first.click();
  const dialog = page.getByRole("dialog", { name: id });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("region", { name: "Answers" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).not.toHaveURL(/case=/);
  await expect(page.getByRole("link", { name: id, exact: true })).toBeFocused();
});

test("a confusion-matrix cell lands on exactly its tickets", async ({ page }) => {
  await page.goto("/results");
  const cell = page.getByRole("link", { name: /tickets with gold/ }).first();
  const n = Number((await cell.textContent())!.trim());
  await cell.click();
  await expect(page).toHaveURL(/\/cases\?/);
  await expect(page.getByText(new RegExp(`of ${n} tickets`))).toBeVisible();
});
