import { describe, expect, test } from "vitest";
import { holm, mcnemarExact, pairedCounts } from "./paired";

describe("pairedCounts", () => {
  test("splits tickets into four cells that add up", () => {
    const a = [true, true, false, false, true, false];
    const b = [true, false, true, false, true, true];
    const c = pairedCounts(a, b);
    expect(c).toEqual({ both_right: 2, both_wrong: 1, a_only: 1, b_only: 2 });
    expect(c.both_right + c.both_wrong + c.a_only + c.b_only).toBe(a.length);
  });
  test("rejects lists of different length", () => {
    expect(() => pairedCounts([true], [true, false])).toThrow(/differ/);
  });
});

describe("mcnemarExact", () => {
  test("textbook: b=1, c=8 gives p = 2 * (1 + 9) / 512 = 0.0391", () => {
    expect(mcnemarExact({ a_only: 1, b_only: 8 })).toBeCloseTo(20 / 512, 10);
    expect(mcnemarExact({ a_only: 1, b_only: 8 })).toBeCloseTo(0.0391, 4);
  });
  test("is symmetric in b and c", () => {
    expect(mcnemarExact({ a_only: 8, b_only: 1 })).toBe(mcnemarExact({ a_only: 1, b_only: 8 }));
  });
  test("no disagreements gives p = 1", () => {
    expect(mcnemarExact({ a_only: 0, b_only: 0 })).toBe(1);
  });
  test("an even split is capped at 1, not above", () => {
    expect(mcnemarExact({ a_only: 5, b_only: 5 })).toBe(1);
  });
  test("all disagreements one way: 10 vs 0 gives 2 / 1024", () => {
    expect(mcnemarExact({ a_only: 0, b_only: 10 })).toBeCloseTo(2 / 1024, 12);
  });
  test("textbook: 6 vs 2 gives 0.2891", () => {
    // n = 8, P(X <= 2) = (1 + 8 + 28) / 256 = 0.14453; times 2 = 0.28906
    expect(mcnemarExact({ a_only: 6, b_only: 2 })).toBeCloseTo(0.2891, 4);
  });
  test("handles a large n without losing precision", () => {
    const p = mcnemarExact({ a_only: 0, b_only: 90 });
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1e-20);
  });
});

describe("holm", () => {
  test("worked example: [.01,.04,.03,.005] -> [.03,.06,.06,.02]", () => {
    const out = holm([0.01, 0.04, 0.03, 0.005]);
    [0.03, 0.06, 0.06, 0.02].forEach((v, i) => expect(out[i]).toBeCloseTo(v, 10));
  });
  test("caps at 1 and keeps the adjusted order monotone", () => {
    expect(holm([0.5, 0.9, 0.7])).toEqual([1, 1, 1]);
    const out = holm([0.001, 0.02, 0.2]);
    expect(out[0]).toBeLessThanOrEqual(out[1]);
    expect(out[1]).toBeLessThanOrEqual(out[2]);
  });
  test("a single p-value is unchanged", () => {
    expect(holm([0.03])).toEqual([0.03]);
  });
  test("never lowers a p-value", () => {
    const ps = [0.2, 0.01, 0.5, 0.04];
    holm(ps).forEach((adj, i) => expect(adj).toBeGreaterThanOrEqual(ps[i]));
  });
});
