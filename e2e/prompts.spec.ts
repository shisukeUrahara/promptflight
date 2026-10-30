import { expect, test } from "@playwright/test";

test("lists the four variants with their frozen version", async ({ page }) => {
  await page.goto("/prompts");
  for (const name of ["zero-json", "zero-strict", "few-json", "few-strict"]) {
    await expect(page.getByRole("list", { name: `${name} versions, newest first` })).toBeVisible();
  }
  await expect(page.getByText("frozen").first()).toBeVisible();
});

test("Monaco loads from the app bundle: no request leaves localhost", async ({ page, baseURL }) => {
  const outside: string[] = [];
  page.on("request", (r) => {
    const host = new URL(r.url()).hostname;
    if (host !== new URL(baseURL!).hostname) outside.push(r.url());
  });
  await page.goto("/prompts");
  await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".view-lines")).toContainText("You classify customer support tickets");
  expect(outside).toEqual([]);
});

test("System and User tabs switch the text in the editor", async ({ page }) => {
  await page.goto("/prompts?name=zero-json");
  await expect(page.locator(".monaco-editor").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "user" }).click();
  await expect(page.locator(".view-lines")).toContainText("{{ticket}}");
});

test("shows the schema preview and, in read-only mode, no way to save", async ({ page }) => {
  await page.goto("/prompts");
  const schema = page.getByRole("region", { name: "Schema preview" });
  await expect(schema).toContainText('"order_id"');
  await expect(schema).toContainText("billing_dispute");
  await expect(page.getByRole("button", { name: "Save as new version" })).toBeDisabled();
  await expect(page.getByText("Read-only: saving is turned off on this server.")).toBeVisible();
});

test("the command to run the shown version is there", async ({ page }) => {
  await page.goto("/prompts?name=few-strict");
  await expect(page.getByText(/pnpm pf run --split tuning --variants [0-9a-f]{8}/)).toBeVisible();
});
