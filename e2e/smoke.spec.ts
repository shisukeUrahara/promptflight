import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PAGES = ["/", "/cases", "/prompts"];
// Every state a visitor can reach, checked at every width and in both themes.
const STATES = [...PAGES, "/?metric=priority", "/cases?disagree=1", "/cases?slice=injection", "/prompts?name=few-strict"];

async function cannotScrollSideways(page: Page) {
  const x = await page.evaluate(() => {
    window.scrollTo(400, window.scrollY);
    return window.scrollX;
  });
  expect(x).toBe(0);
}

for (const path of STATES) {
  test(`${path} has no sideways page scroll`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await cannotScrollSideways(page);
  });
}

test("navigation reaches every page", async ({ page, isMobile }) => {
  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  const nav = page.getByRole("navigation", { name: isMobile ? "Mobile" : "Main" });
  for (const [label, heading] of [["Cases", "Cases"], ["Prompts", "Prompts"], ["Experiments", "Experiments"]]) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    if (isMobile && label !== "Experiments") await page.getByRole("button", { name: "Open menu" }).click();
  }
});

test("theme toggle switches to dark and persists after reload", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const before = await html.getAttribute("class");
  await page.getByRole("button", { name: "Toggle dark mode" }).click();
  await expect.poll(async () => (await html.getAttribute("class"))?.includes("dark")).toBe(!before?.includes("dark"));
  await page.reload();
  await expect.poll(async () => (await html.getAttribute("class"))?.includes("dark")).toBe(!before?.includes("dark"));
});

for (const scheme of ["light", "dark"] as const) {
  test(`axe finds no serious problems in ${scheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const path of STATES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page }).analyze();
      const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(bad, `${path}: ${bad.map((v) => v.id).join(", ")}`).toEqual([]);
    }
  });
}

test("an open ticket dialog passes axe and keeps the page from scrolling sideways", async ({ page }) => {
  await page.goto("/cases");
  await page.getByRole("row").nth(1).getByRole("link").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include("dialog").analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await cannotScrollSideways(page);
});
