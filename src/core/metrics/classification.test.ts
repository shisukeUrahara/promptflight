import { describe, expect, test } from "vitest";
import { accuracy, confusion, macroF1, perClass, type Scored } from "./classification";

// Hand-worked example.
//   1 refund  -> refund   right
//   2 refund  -> dispute  wrong
//   3 dispute -> dispute  right
//   4 dispute -> dispute  right
//   5 other   -> (failed) wrong
//   6 other   -> other    right
const items: Scored[] = [
  { gold: "billing_refund", pred: "billing_refund" },
  { gold: "billing_refund", pred: "billing_dispute" },
  { gold: "billing_dispute", pred: "billing_dispute" },
  { gold: "billing_dispute", pred: "billing_dispute" },
  { gold: "other", pred: null },
  { gold: "other", pred: "other" },
];

const stat = (list: Scored[], category: string) => perClass(list).find((s) => s.category === category)!;

describe("accuracy", () => {
  test("4 of 6, with the failed answer counted as wrong", () => {
    expect(accuracy(items)).toBeCloseTo(4 / 6, 10);
  });
  test("no tickets gives 0, not NaN", () => {
    expect(accuracy([])).toBe(0);
  });
});

describe("perClass", () => {
  test("refund: tp 1, fp 0, fn 1 -> P 1, R 0.5, F1 2/3", () => {
    expect(stat(items, "billing_refund")).toMatchObject({ support: 2, tp: 1, fp: 0, fn: 1, precision: 1, recall: 0.5 });
    expect(stat(items, "billing_refund").f1).toBeCloseTo(2 / 3, 10);
  });
  test("dispute: tp 2, fp 1, fn 0 -> P 2/3, R 1, F1 0.8", () => {
    expect(stat(items, "billing_dispute")).toMatchObject({ tp: 2, fp: 1, fn: 0, recall: 1 });
    expect(stat(items, "billing_dispute").precision).toBeCloseTo(2 / 3, 10);
    expect(stat(items, "billing_dispute").f1).toBeCloseTo(0.8, 10);
  });
  test("other: the failed answer is a miss for its class, so tp 1, fn 1, F1 2/3", () => {
    expect(stat(items, "other")).toMatchObject({ support: 2, tp: 1, fp: 0, fn: 1 });
    expect(stat(items, "other").f1).toBeCloseTo(2 / 3, 10);
  });
  test("a class with no support and no predictions scores 0", () => {
    expect(stat(items, "product_bug")).toMatchObject({ support: 0, tp: 0, fp: 0, fn: 0, precision: 0, recall: 0, f1: 0 });
  });
  test("a class with no support that was predicted anyway scores 0 and shows false positives", () => {
    const s = stat([...items, { gold: "other", pred: "feature_request" }], "feature_request");
    expect(s).toMatchObject({ support: 0, fp: 1, f1: 0 });
  });
  test("always covers all 9 classes", () => {
    expect(perClass([])).toHaveLength(9);
  });
});

describe("macroF1", () => {
  test("(2/3 + 0.8 + 2/3) / 9, because 6 empty classes count as 0", () => {
    expect(macroF1(items)).toBeCloseTo((2 / 3 + 0.8 + 2 / 3) / 9, 10);
  });
  test("perfect answers on every class give 1", () => {
    const all = perClass([]).map((s) => ({ gold: s.category, pred: s.category }));
    expect(macroF1(all)).toBe(1);
  });
  test("nothing scored gives 0", () => {
    expect(macroF1([])).toBe(0);
  });
});

describe("confusion", () => {
  const c = confusion(items);
  const cell = (gold: string, col: string) => c.matrix[c.rows.indexOf(gold as never)][c.columns.indexOf(col as never)];

  test("is 9 rows by 10 columns, the last column being 'failed'", () => {
    expect(c.matrix).toHaveLength(9);
    expect(c.matrix.every((r) => r.length === 10)).toBe(true);
    expect(c.columns[9]).toBe("failed");
  });
  test("cells match the worked example", () => {
    expect(cell("billing_refund", "billing_refund")).toBe(1);
    expect(cell("billing_refund", "billing_dispute")).toBe(1);
    expect(cell("billing_dispute", "billing_dispute")).toBe(2);
    expect(cell("other", "other")).toBe(1);
    expect(cell("other", "failed")).toBe(1);
  });
  test("all cells add up to the number of tickets", () => {
    expect(c.matrix.flat().reduce((a, b) => a + b, 0)).toBe(items.length);
  });
});
