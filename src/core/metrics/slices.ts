import type { Case } from "../domain/case";
import { SLICES, type Slice } from "../domain/labels";
import { INFRA_FAILURES } from "../domain/outcome";
import type { CaseResult } from "../runner/types";

export interface SliceScore {
  n: number;
  correct: number;
  /** correct / n, or null when the run has no ticket of this type. */
  accuracy: number | null;
}

/**
 * Category accuracy of each variant on each ticket type (clear, ambiguous, injection, noisy).
 * Model failures count as wrong; calls that never answered are left out, as everywhere else.
 */
export function accuracyBySlice(results: readonly CaseResult[], cases: readonly Case[]): Record<string, Record<Slice, SliceScore>> {
  const byId = new Map(cases.map((c) => [c.case_id, c]));
  const out: Record<string, Record<Slice, SliceScore>> = {};
  for (const r of results) {
    if (r.code !== null && (INFRA_FAILURES as readonly string[]).includes(r.code)) continue;
    const c = byId.get(r.case_id);
    if (!c) throw new Error(`result for unknown case ${r.case_id}`);
    const table = (out[r.variant] ??= Object.fromEntries(SLICES.map((s) => [s, { n: 0, correct: 0, accuracy: null }])) as Record<Slice, SliceScore>);
    const cell = table[c.slice];
    cell.n++;
    if (r.prediction?.category === c.gold.category) cell.correct++;
    cell.accuracy = cell.correct / cell.n;
  }
  return out;
}
