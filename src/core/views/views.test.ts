import { describe, expect, test } from "vitest";
import type { Case } from "../domain/case";
import type { CaseResult } from "../runner/types";
import { buildCaseRows, filterRows } from "./cases";
import { casesHref, parseCasesQuery } from "./query";

describe("casesHref", () => {
  test("builds a stable, readable link and leaves empty fields out", () => {
    expect(casesHref({})).toBe("/cases");
    expect(casesHref({ run: "20261031T101500Z-holdout", variant: "few-strict", gold: "billing_dispute", pred: "billing_refund" })).toBe(
      "/cases?run=20261031T101500Z-holdout&variant=few-strict&gold=billing_dispute&pred=billing_refund",
    );
    expect(casesHref({ disagree: true, allwrong: true, split: "holdout" })).toBe("/cases?split=holdout&disagree=1&allwrong=1");
    expect(casesHref({ variant: "", gold: undefined })).toBe("/cases");
  });
  test("round-trips through parseCasesQuery", () => {
    const q = { run: "r1", variant: "zero-json", gold: "other", pred: "failed", failure: "invalid_json", slice: "noisy", split: "tuning", disagree: true, allwrong: true, q: "late refund" } as const;
    const url = new URL(casesHref(q), "http://x");
    expect(parseCasesQuery(Object.fromEntries(url.searchParams))).toEqual(q);
  });
});

describe("parseCasesQuery", () => {
  test("q is trimmed, capped at 100 characters, and dropped when empty", () => {
    expect(parseCasesQuery({ q: "  refund  " })).toEqual({ q: "refund" });
    expect(parseCasesQuery({ q: "   " })).toEqual({});
    expect(parseCasesQuery({ q: "x".repeat(150) }).q).toHaveLength(100);
  });
  test("drops values that are not valid instead of failing", () => {
    expect(parseCasesQuery({ gold: "spam", pred: "nope", failure: "x", slice: "y", split: "fewshot-ish", run: "../etc", variant: "a b", disagree: "yes" })).toEqual({});
  });
  test("takes the first value of a repeated key and ignores unknown keys", () => {
    expect(parseCasesQuery({ gold: ["other", "product_bug"], foo: "bar" })).toEqual({ gold: "other" });
  });
  test("accepts failed as a prediction", () => {
    expect(parseCasesQuery({ pred: "failed" })).toEqual({ pred: "failed" });
  });
});

// Four tickets, three variants:
//   t-1 gold other:        A right, B right, C right      (all right)
//   t-2 gold product_bug:  A right, B wrong, C wrong      (disagree)
//   t-3 gold other:        A wrong, B invalid_json, C wrong (all wrong, B failed)
//   t-4 gold other:        A right, B (provider_error), C wrong (B unscored)
const mk = (id: string, category: Case["gold"]["category"], slice: Case["slice"] = "clear", split: Case["split"] = "holdout"): Case => ({
  case_id: id,
  split,
  slice,
  pair_id: null,
  text: `text ${id}`,
  gold: { category, priority: "low", order_id: null },
  injection: null,
  provenance: { drafted_by: "x", intended: { category, priority: "low" }, human_label: null, adjudicated: false },
});
const cases = [mk("t-1", "other"), mk("t-2", "product_bug", "ambiguous_pair"), mk("t-3", "other", "noisy"), mk("t-4", "other", "clear", "tuning")];
const r = (case_id: string, variant: string, pred: Case["gold"]["category"] | null, code: CaseResult["code"] = null): CaseResult => ({
  case_id,
  variant,
  variant_id: "deadbeef",
  code,
  detail: null,
  prediction: pred ? { category: pred, priority: "low", order_id: null } : null,
  raw: code === "provider_error" ? null : { content: "x", refusal: null, finish_reason: "stop" },
  usage: null,
  latency_ms: null,
  cached: false,
});
const results = [
  r("t-1", "A", "other"), r("t-1", "B", "other"), r("t-1", "C", "other"),
  r("t-2", "A", "product_bug"), r("t-2", "B", "feature_request"), r("t-2", "C", "other"),
  r("t-3", "A", "feature_request"), r("t-3", "B", null, "invalid_json"), r("t-3", "C", "billing_refund"),
  r("t-4", "A", "other"), r("t-4", "B", null, "provider_error"), r("t-4", "C", "product_bug"),
];
const rows = buildCaseRows(results, cases);
const ids = (q: Parameters<typeof filterRows>[1]) => filterRows(rows, q).map((x) => x.case_id);

describe("buildCaseRows", () => {
  test("one row per ticket with one cell per variant", () => {
    expect(rows.map((x) => x.case_id)).toEqual(["t-1", "t-2", "t-3", "t-4"]);
    expect(Object.keys(rows[0].variants)).toEqual(["A", "B", "C"]);
    expect(rows[1].variants.A).toMatchObject({ correct: true, pred: "product_bug", unscored: false });
    expect(rows[2].variants.B).toMatchObject({ correct: false, pred: null, code: "invalid_json", unscored: false });
    expect(rows[3].variants.B).toMatchObject({ unscored: true, correct: false });
  });
  test("a result for an unknown case is an error", () => {
    expect(() => buildCaseRows([r("t-9", "A", "other")], cases)).toThrow(/unknown case t-9/);
  });
});

describe("filterRows", () => {
  test("no filter returns everything", () => expect(ids({})).toEqual(["t-1", "t-2", "t-3", "t-4"]));
  test("split, slice and gold category", () => {
    expect(ids({ split: "tuning" })).toEqual(["t-4"]);
    expect(ids({ slice: "noisy" })).toEqual(["t-3"]);
    expect(ids({ gold: "other" })).toEqual(["t-1", "t-3", "t-4"]);
  });
  test("disagree: some variants right and some wrong (unscored ones are ignored)", () => {
    expect(ids({ disagree: true })).toEqual(["t-2", "t-4"]);
  });
  test("allwrong: every variant answered and every answer was wrong", () => {
    expect(ids({ allwrong: true })).toEqual(["t-3"]);
  });
  test("failure code, with and without a variant", () => {
    expect(ids({ failure: "invalid_json" })).toEqual(["t-3"]);
    expect(ids({ failure: "invalid_json", variant: "B" })).toEqual(["t-3"]);
    expect(ids({ failure: "invalid_json", variant: "A" })).toEqual([]);
  });
  test("pred for one variant: a category, or failed", () => {
    expect(ids({ variant: "C", pred: "other" })).toEqual(["t-1", "t-2"]);
    expect(ids({ variant: "B", pred: "failed" })).toEqual(["t-3"]); // an infrastructure failure is not a model failure
  });
  test("a confusion-matrix cell: gold other, variant C answered billing_refund", () => {
    expect(ids({ gold: "other", variant: "C", pred: "billing_refund" })).toEqual(["t-3"]);
  });
  test("a variant that is not in the run matches nothing", () => {
    expect(ids({ variant: "Z" })).toEqual([]);
  });
  test("q matches the ticket id or text, ignoring case", () => {
    expect(ids({ q: "T-2" })).toEqual(["t-2"]);
    expect(ids({ q: "TEXT t-3" })).toEqual(["t-3"]);
    expect(ids({ q: "nothing like this" })).toEqual([]);
    expect(ids({ q: "text", slice: "noisy" })).toEqual(["t-3"]);
  });
  test("filters combine", () => {
    expect(ids({ gold: "other", disagree: true })).toEqual(["t-4"]);
  });
});
