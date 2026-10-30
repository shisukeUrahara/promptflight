import { describe, expect, test } from "vitest";
import { loadEnv } from "./env";

describe("loadEnv", () => {
  test("no key means replay mode", () => {
    expect(loadEnv({}, "/work")).toEqual({ mode: "replay", apiKey: null, readonly: false, dataDir: "/work", model: "gpt-4.1-mini-2025-04-14" });
    expect(loadEnv({ OPENAI_API_KEY: "  " }).mode).toBe("replay");
  });
  test("a key means live mode", () => {
    expect(loadEnv({ OPENAI_API_KEY: "sk-x" })).toMatchObject({ mode: "live", apiKey: "sk-x" });
  });
  test("PF_READONLY=1 turns on read-only; empty and 0 do not", () => {
    expect(loadEnv({ PF_READONLY: "1" }).readonly).toBe(true);
    expect(loadEnv({ PF_READONLY: "" }).readonly).toBe(false);
    expect(loadEnv({ PF_READONLY: "0" }).readonly).toBe(false);
  });
  test("a bad PF_READONLY throws and names the variable", () => {
    expect(() => loadEnv({ PF_READONLY: "yes" })).toThrow(/PF_READONLY/);
  });
  test("PF_MODEL picks the model under test", () => {
    expect(loadEnv({ PF_MODEL: "gpt-4.1-nano-2025-04-14" }).model).toBe("gpt-4.1-nano-2025-04-14");
    expect(loadEnv({ PF_MODEL: "  " }).model).toBe("gpt-4.1-mini-2025-04-14");
  });
  test("PF_DATA_DIR overrides the folder", () => {
    expect(loadEnv({ PF_DATA_DIR: "/data" }, "/work").dataDir).toBe("/data");
  });
});
