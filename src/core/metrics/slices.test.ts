import { expect, test } from "vitest";
import type { Case } from "../domain/case";
import type { CaseResult } from "../runner/types";
import { accuracyBySlice } from "./slices";

const mk = (id: string, slice: Case["slice"]): Case => ({
  case_id: id,
  split: "holdout",
  slice,
  pair_id: slice === "ambiguous_pair" ? "refund-vs-dispute" : null,
  text: "t",
  gold: { category: "other", priority: "low", order_id: null },
  injection: slice === "injection" ? { field: "priority", value: "urgent" } : null,
  provenance: { drafted_by: "x", intended: { category: "other", priority: "low" }, human_label: null, adjudicated: false },
});
const r = (id: string, variant: string, right: boolean, code: CaseResult["code"] = null): CaseResult => ({
  case_id: id,
  variant,
  variant_id: "deadbeef",
  code,
  detail: null,
  prediction: code ? null : { category: right ? "other" : "product_bug", priority: "low", order_id: null },
  raw: null,
  usage: null,
  latency_ms: null,
  cached: false,
});

const cases = [mk("t-1", "clear"), mk("t-2", "clear"), mk("t-3", "ambiguous_pair"), mk("t-4", "injection"), mk("t-5", "noisy")];

test("hand-worked: accuracy per ticket type and variant", () => {
  const out = accuracyBySlice(
    [
      r("t-1", "A", true), r("t-2", "A", false), r("t-3", "A", true), r("t-4", "A", false), r("t-5", "A", true),
      r("t-1", "B", true), r("t-2", "B", true), r("t-3", "B", false), r("t-4", "B", true),
    ],
    cases,
  );
  expect(out.A.clear).toEqual({ n: 2, correct: 1, accuracy: 0.5 });
  expect(out.A.ambiguous_pair.accuracy).toBe(1);
  expect(out.A.injection.accuracy).toBe(0);
  expect(out.B.clear.accuracy).toBe(1);
  expect(out.B.noisy).toEqual({ n: 0, correct: 0, accuracy: null }); // no noisy result for B
});

test("a model failure counts as wrong; a call that never answered is left out", () => {
  const out = accuracyBySlice([r("t-1", "A", true), r("t-2", "A", false, "invalid_json"), r("t-3", "A", false, "provider_error")], cases);
  expect(out.A.clear).toEqual({ n: 2, correct: 1, accuracy: 0.5 });
  expect(out.A.ambiguous_pair.n).toBe(0);
});

test("a result for an unknown ticket is an error", () => {
  expect(() => accuracyBySlice([r("t-9", "A", true)], cases)).toThrow(/unknown case/);
});
