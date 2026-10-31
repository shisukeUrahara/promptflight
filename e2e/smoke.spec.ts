import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PAGES = ["/", "/results", "/cases", "/prompts"];
// Every state a visitor can reach, checked at every width and in both themes.
const STATES = [...PAGES, "/results?metric=priority", "/cases?disagree=1", "/cases?slice=injection", "/prompts?name=few-strict", "/cases?q=no-such-ticket", "/no-such-page"];

async function cannotScrollSideways(page: Page) {
  const x = await page.evaluate(() => {
    window.scrollTo(400, window.scrollY);
    return window.scrollX;
  });
  expect(x).toBe(0);
  // body hides horizontal overflow, so also check the layout is not wider than the screen:
  // on a phone a wide element otherwise makes the browser zoom the whole page out.
  const [content, screen] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(content).toBeLessThanOrEqual(screen);
}

for (const path of STATES) {
  test(`${path} has no sideways page scroll`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await cannotScrollSideways(page);
  });
}

test("an unknown address gets a 404 page that links back", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("navigation", { name: "Pages" }).getByRole("link", { name: "Results" }).click();
  await expect(page).toHaveURL(/\/results$/);
});

test("keyboard focus shows a ring that keeps the pill shape", async ({ page }) => {
  await page.goto("/results");
  const chip = page.getByRole("navigation", { name: "Model" }).getByRole("link").first();
  await chip.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const style = await chip.evaluate((el) => {
    const s = getComputedStyle(el);
    return { outline: s.outlineStyle, radius: parseFloat(s.borderTopLeftRadius) };
  });
  expect(style.outline).toBe("solid");
  expect(style.radius).toBeGreaterThan(100);
});

test("navigation reaches every page", async ({ page, isMobile }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: isMobile ? "Mobile" : "Main" });
  for (const [label, path] of [["Results", "/results"], ["Tickets", "/cases"], ["Prompts", "/prompts"], ["Overview", "/"]]) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}`));
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }
});

test("the search box takes you to matching tickets", async ({ page, isMobile }) => {
  test.skip(isMobile, "the phone has a search link instead of a box");
  await page.goto("/");
  const box = page.getByRole("searchbox", { name: "Search tickets" });
  test.skip(!(await box.isVisible()), "the box shows from 1024 px");
  await box.fill("refund");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/cases\?q=refund/);
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
  await page.getByRole("link", { name: /^t-\d+$/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).include("dialog").analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => v.id)).toEqual([]);
  await cannotScrollSideways(page);
});
