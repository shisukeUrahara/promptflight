import type { Case } from "../domain/case";
import type { Category } from "../domain/labels";
import { INFRA_FAILURES, type OutcomeCode } from "../domain/outcome";
import type { CaseResult } from "../runner/types";
import type { CasesQuery } from "./query";

export interface VariantCell {
  code: OutcomeCode | null;
  /** The category the variant gave, or null if it gave none. */
  pred: Category | null;
  /** True only for a valid answer with the right category. */
  correct: boolean;
  /** The call never answered (infrastructure failure): neither right nor wrong. */
  unscored: boolean;
  priority: string | null;
  order_id: string | null;
}

export interface CaseRow {
  case_id: string;
  text: string;
  split: Case["split"];
  slice: Case["slice"];
  gold: Case["gold"];
  injection: Case["injection"];
  /** Keyed by variant name, in run order. */
  variants: Record<string, VariantCell>;
}

const isInfra = (code: OutcomeCode | null) => code !== null && (INFRA_FAILURES as readonly string[]).includes(code);

/** One row per ticket, with one cell per variant. */
export function buildCaseRows(results: readonly CaseResult[], cases: readonly Case[]): CaseRow[] {
  const byId = new Map(cases.map((c) => [c.case_id, c]));
  const rows = new Map<string, CaseRow>();
  for (const r of results) {
    const c = byId.get(r.case_id);
    if (!c) throw new Error(`result for unknown case ${r.case_id}`);
    let row = rows.get(r.case_id);
    if (!row) {
      row = { case_id: c.case_id, text: c.text, split: c.split, slice: c.slice, gold: c.gold, injection: c.injection, variants: {} };
      rows.set(r.case_id, row);
    }
    row.variants[r.variant] = {
      code: r.code,
      pred: r.prediction?.category ?? null,
      correct: r.prediction?.category === c.gold.category,
      unscored: isInfra(r.code),
      priority: r.prediction?.priority ?? null,
      order_id: r.prediction?.order_id ?? null,
    };
  }
  return [...rows.values()].sort((a, b) => a.case_id.localeCompare(b.case_id));
}

/** The variants that answered this ticket. */
const scored = (row: CaseRow) => Object.values(row.variants).filter((v) => !v.unscored);

export function filterRows(rows: readonly CaseRow[], q: CasesQuery): CaseRow[] {
  return rows.filter((row) => {
    if (q.split && row.split !== q.split) return false;
    if (q.slice && row.slice !== q.slice) return false;
    if (q.gold && row.gold.category !== q.gold) return false;

    if (q.variant) {
      const cell = row.variants[q.variant];
      if (!cell) return false;
      if (q.pred === "failed" && !(cell.pred === null && !cell.unscored)) return false;
      if (q.pred && q.pred !== "failed" && cell.pred !== q.pred) return false;
      if (q.failure && cell.code !== q.failure) return false;
    } else if (q.failure && !Object.values(row.variants).some((v) => v.code === q.failure)) {
      return false;
    }

    const s = scored(row);
    if (q.disagree && !(s.some((v) => v.correct) && s.some((v) => !v.correct))) return false;
    // A ticket where a call is missing cannot be called "wrong everywhere".
    if (q.allwrong && !(s.length === Object.keys(row.variants).length && s.every((v) => !v.correct))) return false;
    return true;
  });
}
