import { describe, expect, test } from "vitest";
import { Pricing, actualUsd, estimateUsd, loadPricing } from "./pricing";

const pricing = loadPricing("pricing.json");
const MINI = "gpt-4.1-mini-2025-04-14";

describe("pricing.json", () => {
  test("matches the schema and carries a source and date", () => {
    expect(Pricing.safeParse(pricing).success).toBe(true);
    expect(pricing.retrieved_at).toBe("2026-10-29");
  });
  test("rejects a malformed file", () => {
    expect(Pricing.safeParse({ ...pricing, retrieved_at: "yesterday" }).success).toBe(false);
  });
});

describe("cost", () => {
  test("actual: 1000 in + 200 out on mini = 0.0004 + 0.00032", () => {
    expect(actualUsd(pricing, MINI, { prompt_tokens: 1000, completion_tokens: 200 })).toBeCloseTo(0.00072, 10);
  });
  test("estimate: 4000 chars = 1000 tokens in, plus 200 out", () => {
    expect(estimateUsd(pricing, MINI, [{ inputChars: 4000, maxOutputTokens: 200 }])).toBeCloseTo(0.00072, 10);
  });
  test("estimate sums calls, and no calls costs nothing", () => {
    const one = { inputChars: 4000, maxOutputTokens: 200 };
    expect(estimateUsd(pricing, MINI, [one, one])).toBeCloseTo(0.00144, 10);
    expect(estimateUsd(pricing, MINI, [])).toBe(0);
  });
  test("unknown model throws", () => {
    expect(() => actualUsd(pricing, "gpt-9", { prompt_tokens: 1, completion_tokens: 1 })).toThrow(/no price/);
  });
});
