import { describe, expect, test } from "vitest";
import { CATEGORIES, SLICES, SPLITS } from "../domain/labels";
import { mulberry32 } from "./rng";
import { SLICE_COUNTS, SPLIT_PLAN, assignSplits } from "./split";

describe("mulberry32", () => {
  test("matches the reference outputs", () => {
    const r = mulberry32(1);
    expect([r(), r(), r()]).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
    const q = mulberry32(42);
    expect([q(), q(), q()]).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
  });
});

describe("assignSplits", () => {
  const splits = assignSplits(7);

  test("each cell matches the plan", () => {
    for (const category of CATEGORIES) {
      for (const slice of SLICES) {
        const cell = splits[`${category}/${slice}`];
        expect(cell).toHaveLength(SLICE_COUNTS[slice]);
        for (const split of SPLITS) {
          expect(cell.filter((s) => s === split)).toHaveLength(SPLIT_PLAN[slice][split]);
        }
      }
    }
  });

  test("each category has 1 fewshot, 5 tuning and 10 holdout", () => {
    for (const category of CATEGORIES) {
      const all = SLICES.flatMap((slice) => splits[`${category}/${slice}`]);
      expect(all).toHaveLength(16);
      expect(SPLITS.map((s) => all.filter((x) => x === s).length)).toEqual([1, 5, 10]);
    }
  });

  test("same seed gives the same split, another seed differs", () => {
    expect(assignSplits(7)).toEqual(splits);
    expect(assignSplits(8)).not.toEqual(splits);
  });
});
