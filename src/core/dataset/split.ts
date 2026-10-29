import { CATEGORIES, SLICES, type Category, type Slice, type Split } from "../domain/labels";
import { mulberry32, shuffle } from "./rng";

/** Tickets per slice, per category. 16 in all. */
export const SLICE_COUNTS: Record<Slice, number> = { clear: 8, ambiguous_pair: 4, injection: 2, noisy: 2 };

/** How each (category, slice) cell divides across splits. Per category: 1 / 5 / 10. */
export const SPLIT_PLAN: Record<Slice, Record<Split, number>> = {
  clear: { fewshot: 1, tuning: 2, holdout: 5 },
  ambiguous_pair: { fewshot: 0, tuning: 1, holdout: 3 },
  injection: { fewshot: 0, tuning: 1, holdout: 1 },
  noisy: { fewshot: 0, tuning: 1, holdout: 1 },
};

export type Cell = `${Category}/${Slice}`;

/**
 * The split of every ticket in every cell. Each cell is shuffled on its own,
 * so every split gets its share of every slice in every category.
 */
export function assignSplits(seed: number): Record<Cell, Split[]> {
  const rng = mulberry32(seed);
  const out = {} as Record<Cell, Split[]>;
  for (const category of CATEGORIES) {
    for (const slice of SLICES) {
      const plan = SPLIT_PLAN[slice];
      const labels = (Object.keys(plan) as Split[]).flatMap((s) => Array<Split>(plan[s]).fill(s));
      out[`${category}/${slice}`] = shuffle(labels, rng);
    }
  }
  return out;
}
