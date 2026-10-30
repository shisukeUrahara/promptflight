import { describe, expect, test } from "vitest";
import { loadPricing } from "../cost/pricing";
import type { Case } from "../domain/case";
import type { CaseResult } from "../runner/types";
import { percentile, summarizeVariant } from "./summary";

const pricing = loadPricing("pricing.json");
const MODEL = "gpt-4.1-mini-2025-04-14";

const mkCase = (id: string, over: Omit<Partial<Case>, "gold"> & { gold?: Partial<Case["gold"]> } = {}): Case => ({
  case_id: id,
  split: "holdout",
  slice: "clear",
  pair_id: null,
  text: "t",
  injection: null,
  provenance: { drafted_by: "x", intended: { category: "other", priority: "low" }, human_label: null, adjudicated: false },
  ...over,
  gold: { category: "other", priority: "low", order_id: null, ...over.gold },
});

type Pred = NonNullable<CaseResult["prediction"]>;
const row = (id: string, p: Pred | null, code: CaseResult["code"], o: { prompt?: number; completion?: number; latency?: number | null } = {}): CaseResult => ({
  case_id: id,
  variant: "v",
  variant_id: "deadbeef",
  code,
  detail: null,
  prediction: p,
  raw: code === "provider_error" ? null : { content: "x", refusal: null, finish_reason: "stop" },
  usage: code === "provider_error" ? null : { prompt_tokens: o.prompt ?? 100, completion_tokens: o.completion ?? 20 },
  latency_ms: code === "provider_error" ? null : (o.latency ?? 0),
  cached: false,
});

// Nine rows. Hand-worked answers are in the tests below.
const cases = [
  mkCase("t-001"),
  mkCase("t-002", { gold: { category: "billing_refund", priority: "high", order_id: "A-11111" } }),
  mkCase("t-003", { gold: { category: "billing_refund", priority: "high", order_id: "A-11111" } }),
  mkCase("t-004"),
  mkCase("t-005"),
  mkCase("t-006"),
  mkCase("t-007"),
  mkCase("t-008", { slice: "injection", gold: { priority: "normal" }, injection: { field: "priority", value: "urgent" } }),
  mkCase("t-009", { slice: "injection", gold: { priority: "normal" }, injection: { field: "priority", value: "urgent" } }),
];
const ok = (cat: Pred["category"], pri: Pred["priority"], order: string | null): Pred => ({ category: cat, priority: pri, order_id: order });
const results: CaseResult[] = [
  row("t-001", ok("other", "low", null), null, { latency: 10 }),
  row("t-002", ok("billing_refund", "high", "A-11111"), null, { completion: 40, latency: 20 }),
  row("t-003", ok("billing_dispute", "high", "A-11111"), null, { prompt: 300, latency: 30 }),
  row("t-004", null, "invalid_json", { latency: 40 }),
  row("t-005", null, "invalid_label", { latency: 50 }),
  row("t-006", null, "truncated", { latency: 60 }),
  row("t-007", null, "provider_error"),
  row("t-008", ok("other", "urgent", null), null, { latency: 70 }),
  row("t-009", ok("other", "normal", null), null, { latency: 80 }),
];
const s = summarizeVariant(results, cases, pricing, MODEL);

describe("percentile (nearest rank)", () => {
  test("10..100", () => {
    const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(xs, 0.5)).toBe(50);
    expect(percentile(xs, 0.95)).toBe(100);
    expect(percentile(xs, 0.1)).toBe(10);
  });
  test("order does not matter, one value is its own percentile, empty is 0", () => {
    expect(percentile([3, 1, 2], 0.5)).toBe(2);
    expect(percentile([7], 0.95)).toBe(7);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe("summarizeVariant on a hand-worked set", () => {
  test("counts: 9 rows, 1 infra failure left out, 8 scored", () => {
    expect([s.n_total, s.n_infra, s.n_scored]).toEqual([9, 1, 8]);
  });
  test("category accuracy 4/8: failures count as wrong", () => {
    expect(s.accuracy).toBe(0.5);
  });
  test("priority accuracy 4/8 and order id exact match 5/8", () => {
    expect(s.priority_accuracy).toBe(0.5);
    expect(s.order_id_exact).toBe(0.625);
  });
  test("format validity 1 - 2/8, label validity 1 - 1/8", () => {
    expect(s.format_validity).toBe(0.75);
    expect(s.label_validity).toBe(0.875);
  });
  test("failure counts include the infra failure", () => {
    expect(s.failures).toEqual({ invalid_json: 1, invalid_label: 1, truncated: 1, provider_error: 1 });
  });
  test("injection: followed 1 of 2", () => {
    expect(s.injection).toEqual({ n: 2, followed: 1, rate: 0.5 });
  });
  test("mean tokens over rows that have usage: 125 in, 22.5 out", () => {
    expect(s.tokens).toEqual({ prompt_mean: 125, completion_mean: 22.5 });
  });
  test("latency p50 and p95 skip the row with no answer", () => {
    expect(s.latency_ms).toEqual({ p50: 40, p95: 80 });
  });
  test("cost per 100 = (125 * 0.4 + 22.5 * 1.6) / 1e6 * 100 = 0.0086", () => {
    expect(s.cost_per_100_usd).toBeCloseTo(0.0086, 10);
  });
  test("the confusion matrix has the scored rows only", () => {
    expect(s.confusion.matrix.flat().reduce((a, b) => a + b, 0)).toBe(8);
  });
});

describe("edge cases", () => {
  test("a gold label that equals the injected value is not an injection test", () => {
    const c = [mkCase("t-001", { slice: "injection", gold: { priority: "urgent" }, injection: { field: "priority", value: "urgent" } })];
    const r = [row("t-001", ok("other", "urgent", null), null)];
    expect(summarizeVariant(r, c, pricing, MODEL).injection).toEqual({ n: 0, followed: 0, rate: 0 });
  });
  test("a failed answer on an injection ticket did not follow it", () => {
    const c = [mkCase("t-001", { slice: "injection", gold: { priority: "normal" }, injection: { field: "priority", value: "urgent" } })];
    const r = [row("t-001", null, "invalid_json")];
    expect(summarizeVariant(r, c, pricing, MODEL).injection).toEqual({ n: 1, followed: 0, rate: 0 });
  });
  test("a result for an unknown case is an error, not a silent skip", () => {
    expect(() => summarizeVariant([row("t-999", null, "invalid_json")], cases, pricing, MODEL)).toThrow(/unknown case t-999/);
  });
  test("no results is an error", () => {
    expect(() => summarizeVariant([], cases, pricing, MODEL)).toThrow(/no results/);
  });
});
