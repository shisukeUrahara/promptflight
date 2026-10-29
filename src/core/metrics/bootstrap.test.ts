import { describe, expect, test } from "vitest";
import { bootstrapCi, pairedBootstrapCi, quantile } from "./bootstrap";
import { accuracy, macroF1, type Scored } from "./classification";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("quantile", () => {
  test("interpolates between neighbours", () => {
    expect(quantile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4, 5], 1)).toBe(5);
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
  });
});

describe("bootstrapCi", () => {
  const half = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0];

  test("same seed gives the same interval; another seed gives a different draw sequence", () => {
    const a = bootstrapCi(half, mean, { seed: 7 });
    expect(bootstrapCi(half, mean, { seed: 7 })).toEqual(a);
    const wide = Array.from({ length: 40 }, (_, i) => (i * 7) % 5);
    expect(bootstrapCi(wide, mean, { seed: 1 })).not.toEqual(bootstrapCi(wide, mean, { seed: 2 }));
  });

  test("known small example: 5 of 10 right gives [0.2, 0.8] around 0.5", () => {
    // Bootstrap means of 10 fair draws are Binomial(10, .5)/10; its 2.5% and 97.5% points are 0.2 and 0.8.
    expect(bootstrapCi(half, mean, { seed: 1 })).toEqual({ point: 0.5, lo: 0.2, hi: 0.8 });
  });

  test("a constant sample has zero width", () => {
    expect(bootstrapCi([0.5, 0.5, 0.5], mean)).toEqual({ point: 0.5, lo: 0.5, hi: 0.5 });
  });

  test("more data gives a narrower interval", () => {
    const few = bootstrapCi(half, mean, { seed: 1 });
    const many = bootstrapCi(Array.from({ length: 100 }, (_, i) => (i < 50 ? 1 : 0)), mean, { seed: 1 });
    expect(many.hi - many.lo).toBeLessThan(few.hi - few.lo);
  });

  test("an empty sample gives zeros, not NaN", () => {
    expect(bootstrapCi([], mean)).toEqual({ point: 0, lo: 0, hi: 0 });
  });

  test("works for a statistic that is not a per-ticket mean (macro-F1)", () => {
    const items: Scored[] = [
      ...Array.from({ length: 12 }, () => ({ gold: "billing_refund", pred: "billing_refund" }) as Scored),
      ...Array.from({ length: 8 }, () => ({ gold: "other", pred: "billing_refund" }) as Scored),
      ...Array.from({ length: 10 }, () => ({ gold: "other", pred: "other" }) as Scored),
    ];
    const ci = bootstrapCi(items, macroF1, { seed: 3, draws: 2000 });
    expect(ci.point).toBeCloseTo(macroF1(items), 10);
    expect(ci.lo).toBeLessThanOrEqual(ci.point);
    expect(ci.hi).toBeGreaterThanOrEqual(ci.point);
    expect(ci.hi).toBeLessThanOrEqual(1);
    expect(ci.lo).toBeGreaterThanOrEqual(0);
  });

  test("honours the level", () => {
    const narrow = bootstrapCi(half, mean, { seed: 1, level: 0.5 });
    const wide = bootstrapCi(half, mean, { seed: 1, level: 0.95 });
    expect(narrow.hi - narrow.lo).toBeLessThan(wide.hi - wide.lo);
  });
});

describe("pairedBootstrapCi", () => {
  const right: Scored = { gold: "other", pred: "other" };
  const wrong: Scored = { gold: "other", pred: "billing_refund" };

  test("identical variants give a difference of exactly 0", () => {
    const pairs = Array.from({ length: 30 }, (_, i) => ({ a: i % 3 ? right : wrong, b: i % 3 ? right : wrong }));
    expect(pairedBootstrapCi(pairs, accuracy, { seed: 1 })).toEqual({ point: 0, lo: 0, hi: 0 });
  });

  test("b right and a wrong everywhere gives [1, 1]", () => {
    const pairs = Array.from({ length: 10 }, () => ({ a: wrong, b: right }));
    expect(pairedBootstrapCi(pairs, accuracy)).toEqual({ point: 1, lo: 1, hi: 1 });
  });

  test("pairing separates two variants whose own intervals overlap", () => {
    // 40 tickets. a is right on the first 20. b is right on those 20 and on 8 more. b never loses where a wins.
    const pairs = Array.from({ length: 40 }, (_, i) => ({ a: i < 20 ? right : wrong, b: i < 28 ? right : wrong }));
    const a = bootstrapCi(pairs.map((p) => p.a), accuracy, { seed: 1 });
    const b = bootstrapCi(pairs.map((p) => p.b), accuracy, { seed: 1 });
    expect(a.hi).toBeGreaterThan(b.lo); // the separate intervals overlap
    const diff = pairedBootstrapCi(pairs, accuracy, { seed: 1 });
    expect(diff.point).toBeCloseTo(0.2, 10);
    expect(diff.lo).toBeGreaterThan(0); // the paired interval excludes 0
  });

  test("same seed, same paired interval", () => {
    const pairs = Array.from({ length: 25 }, (_, i) => ({ a: i % 2 ? right : wrong, b: i % 5 ? right : wrong }));
    expect(pairedBootstrapCi(pairs, accuracy, { seed: 4 })).toEqual(pairedBootstrapCi(pairs, accuracy, { seed: 4 }));
  });
});
