import { describe, expect, test } from "vitest";
import { agreement, cohenKappa } from "./agreement";

/** Builds two rater lists from a 2x2 table: [yes/yes, yes/no, no/yes, no/no]. */
function fromTable([yy, yn, ny, nn]: number[]) {
  const a: string[] = [];
  const b: string[] = [];
  const add = (n: number, x: string, y: string) => {
    for (let i = 0; i < n; i++) {
      a.push(x);
      b.push(y);
    }
  };
  add(yy, "yes", "yes");
  add(yn, "yes", "no");
  add(ny, "no", "yes");
  add(nn, "no", "no");
  return { a, b };
}

describe("cohenKappa", () => {
  test("textbook example: 20/5/10/15 gives 0.4", () => {
    const { a, b } = fromTable([20, 5, 10, 15]);
    expect(agreement(a, b)).toBeCloseTo(0.7, 10);
    expect(cohenKappa(a, b)).toBeCloseTo(0.4, 10);
  });

  test("second textbook example: 45/15/25/15 gives 0.1304", () => {
    const { a, b } = fromTable([45, 15, 25, 15]);
    expect(cohenKappa(a, b)).toBeCloseTo(0.1304, 3);
  });

  test("perfect agreement is 1", () => {
    expect(cohenKappa(["a", "b", "c"], ["a", "b", "c"])).toBe(1);
  });

  test("one shared label is defined as 1", () => {
    expect(cohenKappa(["a", "a"], ["a", "a"])).toBe(1);
  });

  test("agreement at chance level is 0", () => {
    const { a, b } = fromTable([25, 25, 25, 25]);
    expect(cohenKappa(a, b)).toBeCloseTo(0, 10);
  });

  test("works with more than two labels", () => {
    // A uses a,a,b,c and B uses a,a,b,a. po = 3/4. pe = (2/4)(3/4) + (1/4)(1/4) + 0 = 7/16. kappa = 5/9.
    expect(cohenKappa(["a", "a", "b", "c"], ["a", "a", "b", "a"])).toBeCloseTo(5 / 9, 10);
  });

  test("rejects unequal or empty lists", () => {
    expect(() => cohenKappa(["a"], ["a", "b"])).toThrow(/differ/);
    expect(() => agreement([], [])).toThrow(/no items/);
  });
});
