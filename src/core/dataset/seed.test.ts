import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { CATEGORIES } from "../domain/labels";
import { AMBIGUOUS_PAIRS, PAIRS_PER_CATEGORY } from "../domain/pairs";
import { seedIds } from "./seed";

const guide = readFileSync("docs/labeling_guide.md", "utf8");

describe("labeling guide", () => {
  test.each(AMBIGUOUS_PAIRS.map((p) => p.id))("has a rule for %s", (id) => {
    expect(guide).toContain(`### ${id}`);
  });

  test("every category appears in at least one pair", () => {
    const covered = new Set<string>(AMBIGUOUS_PAIRS.flatMap((p) => p.categories));
    expect(CATEGORIES.filter((c) => !covered.has(c))).toEqual([]);
  });

  test("every category has 4 ambiguous tickets from pairs that include it", () => {
    for (const category of CATEGORIES) {
      const ids = PAIRS_PER_CATEGORY[category];
      expect(ids).toHaveLength(4);
      for (const id of ids) {
        const pair = AMBIGUOUS_PAIRS.find((p) => p.id === id);
        expect(pair?.categories as readonly string[]).toContain(category);
      }
    }
  });
});

describe("seedIds", () => {
  test("picks the fewshot case plus the first 2 tuning cases per category", () => {
    const gold = (category: (typeof CATEGORIES)[number]) => ({ category, priority: "low" as const, order_id: null });
    const cases = CATEGORIES.flatMap((category, i) => {
      const n = (k: number) => `t-${String(i * 10 + k).padStart(3, "0")}`;
      return [
        { case_id: n(1), split: "fewshot" as const, gold: gold(category) },
        { case_id: n(5), split: "tuning" as const, gold: gold(category) },
        { case_id: n(3), split: "tuning" as const, gold: gold(category) },
        { case_id: n(4), split: "tuning" as const, gold: gold(category) },
        { case_id: n(9), split: "holdout" as const, gold: gold(category) },
      ];
    });
    const ids = seedIds(cases);
    expect(ids.size).toBe(27);
    expect(ids.has("t-001") && ids.has("t-003") && ids.has("t-004")).toBe(true);
    expect(ids.has("t-005") || ids.has("t-009")).toBe(false);
  });
});
