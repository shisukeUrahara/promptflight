import path from "node:path";
import { defineConfig } from "@playwright/test";

const PORT = 3100;

// Tests run against a production build that reads the synthetic folder e2e/fixtures/data,
// with saving disabled. Override the server with E2E_BASE_URL to test something already running.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${PORT}` },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm start --port ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        env: { PF_DATA_DIR: path.resolve("e2e/fixtures/data"), PF_READONLY: "1" },
      },
});
