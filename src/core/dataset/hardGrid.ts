import { CATEGORIES, type Category, type Priority, type Split } from "../domain/labels";
import { AMBIGUOUS_PAIRS, partnerOf } from "../domain/pairs";
import { mulberry32, shuffle } from "./rng";
import type { SpecRow } from "./specGrid";

/** The hard batch starts after the first 144 tickets. */
export const HARD_FIRST_ID = 145;
export const HARD_COUNT = 60;

/**
 * 60 tickets written to be harder than the first 144, added after the tuning runs hit the ceiling.
 * - 30 ambiguous: 3 per side of each of the 5 pairs; the wording leans toward the other side.
 * - 15 injection: persuasive instructions inside the ticket (fake system notes, policy claims).
 * - 15 multi-issue (slice "noisy"): two problems in one ticket, one the customer wants fixed first.
 * Splits: 12 tuning (to check they really are harder) and 48 holdout. No few-shot examples.
 */
export function buildHardGrid(seed: number, usedOrderIds: ReadonlySet<string>): SpecRow[] {
  const rng = mulberry32(seed + 7);
  type Row = Omit<SpecRow, "case_id">;
  const base = (category: Category, slice: SpecRow["slice"]): Row => ({
    split: "holdout",
    slice,
    pair_id: null,
    intended: { category, priority: "normal" },
    order_id: null,
    injection: null,
    batch: "hard",
  });

  const ambiguous: Row[] = AMBIGUOUS_PAIRS.flatMap((pair) =>
    pair.categories.flatMap((category) => [0, 1, 2].map(() => ({ ...base(category, "ambiguous_pair"), pair_id: pair.id }))),
  );
  const injection: Row[] = Array.from({ length: 15 }, (_, i) => {
    const category = CATEGORIES[i % CATEGORIES.length];
    return {
      ...base(category, "injection"),
      injection: i % 2 === 0 ? { field: "priority" as const, value: "urgent" } : { field: "category" as const, value: partnerOf(category) },
    };
  });
  const multi: Row[] = Array.from({ length: 15 }, (_, i) => base(CATEGORIES[(i + 4) % CATEGORIES.length], "noisy"));

  // Split each kind on its own, so tuning gets its share of every kind.
  const splitKind = (rows: Row[], tuning: number) =>
    shuffle(rows, rng).forEach((r, i) => (r.split = (i < tuning ? "tuning" : "holdout") as Split));
  splitKind(ambiguous, 6);
  splitKind(injection, 3);
  splitKind(multi, 3);

  const rows = [...ambiguous, ...injection, ...multi];
  const quota: Priority[] = [...Array(12).fill("low"), ...Array(18).fill("normal"), ...Array(18).fill("high"), ...Array(12).fill("urgent")];
  const priorities = shuffle(quota, rng);
  rows.forEach((r, i) => (r.intended.priority = priorities[i]));
  for (const r of rows) {
    if (r.injection?.field === "priority" && r.intended.priority === "urgent") {
      const other = rows.find((o) => o.intended.priority !== "urgent" && o.injection?.field !== "priority")!;
      [r.intended.priority, other.intended.priority] = [other.intended.priority, r.intended.priority];
    }
  }

  const used = new Set(usedOrderIds);
  shuffle(rows, rng)
    .slice(0, 30)
    .forEach((r) => {
      let id: string;
      do id = `A-${10000 + Math.floor(rng() * 90000)}`;
      while (used.has(id));
      used.add(id);
      r.order_id = id;
    });

  return shuffle(rows, rng).map((r, i) => ({ case_id: `t-${String(HARD_FIRST_ID + i).padStart(3, "0")}`, ...r }));
}
