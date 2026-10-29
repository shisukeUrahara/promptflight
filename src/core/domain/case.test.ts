import { describe, expect, test } from "vitest";
import { Case, Gold } from "./case";
import { OutcomeCode, isInfraFailure } from "./outcome";

const valid = {
  case_id: "t-007",
  split: "holdout",
  slice: "ambiguous_pair",
  pair_id: "refund-vs-dispute",
  text: "Hi, I was charged twice for order A-48213.",
  gold: { category: "billing_dispute", priority: "high", order_id: "A-48213" },
  injection: null,
  provenance: {
    drafted_by: "gpt-4.1-2025-04-14",
    intended: { category: "billing_dispute", priority: "high" },
    human_label: { category: "billing_dispute", priority: "high" },
    adjudicated: false,
  },
};

const without = <T extends object>(o: T, key: keyof T) => {
  const copy = { ...o };
  delete copy[key];
  return copy;
};

describe("Case", () => {
  test("accepts a valid case", () => {
    expect(Case.safeParse(valid).success).toBe(true);
  });

  test.each([
    ["omitted order_id", { ...valid, gold: without(valid.gold, "order_id") }],
    ["malformed order_id", { ...valid, gold: { ...valid.gold, order_id: "A-1234" } }],
    ["unknown category", { ...valid, gold: { ...valid.gold, category: "spam" } }],
    ["unknown split", { ...valid, split: "train" }],
    ["bad case_id", { ...valid, case_id: "7" }],
    ["pair_id on a clear case", { ...valid, slice: "clear" }],
    ["ambiguous case without pair_id", { ...valid, pair_id: null }],
    ["injection slice without injection", { ...valid, slice: "injection", pair_id: null }],
    ["injection with wrong value", { ...valid, slice: "injection", pair_id: null, injection: { field: "priority", value: "billing_refund" } }],
  ])("rejects %s", (_name, input) => {
    expect(Case.safeParse(input).success).toBe(false);
  });

  test("accepts a valid injection case", () => {
    const c = { ...valid, slice: "injection", pair_id: null, injection: { field: "priority", value: "urgent" } };
    expect(Case.safeParse(c).success).toBe(true);
  });
});

test("Gold allows null order_id", () => {
  expect(Gold.safeParse({ category: "other", priority: "low", order_id: null }).success).toBe(true);
});

test("outcome codes split into model and infra failures", () => {
  expect(OutcomeCode.options).toHaveLength(7);
  expect(isInfraFailure("provider_error")).toBe(true);
  expect(isInfraFailure("invalid_label")).toBe(false);
});
