import type { ContrastReport, RunScores } from "../artifacts/scores";
import type { Case } from "../domain/case";
import type { Slice } from "../domain/labels";
import { accuracyBySlice } from "../metrics/slices";
import type { CaseResult } from "../runner/types";
import { buildCaseRows, filterRows } from "./cases";

export const SIGNIFICANT = 0.05;

export interface PromptSummary {
  name: string;
  id: string;
  accuracy: number;
  /** The single highest accuracy in the run (the first one on a tie). */
  highest: boolean;
  injection: { followed: number; n: number };
  bySlice: Record<Slice, number | null>;
  promptTokens: number;
}

export interface Overview {
  nCases: number;
  prompts: PromptSummary[];
  verdict: {
    /** True when any primary (category) comparison survives Holm. */
    anyShown: boolean;
    /** The primary comparison with the largest accuracy gap, shown or not. */
    largest: ContrastReport | null;
  };
  /** Lowest share of valid answers (format and label) over the variants. */
  validity: number;
  injection: { min: number; max: number; n: number };
  promptTokens: { min: number; max: number };
  runCostUsd: number;
  alwaysWrong: { count: number; topGold: { label: string; count: number } | null; topAnswer: { label: string; count: number } | null };
}

const top = (labels: string[]) => {
  const counts = new Map<string, number>();
  labels.forEach((l) => counts.set(l, (counts.get(l) ?? 0) + 1));
  const [label, count] = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];
  return label === undefined ? null : { label, count: count! };
};

/** Everything the Overview page says about one run, computed from its files, never typed in. */
export function overviewStats(scores: RunScores, results: readonly CaseResult[], cases: readonly Case[]): Overview {
  const slices = accuracyBySlice(results, cases);
  const best = Math.max(...scores.variants.map((v) => v.accuracy));
  const firstBest = scores.variants.find((v) => v.accuracy === best)?.variant;
  const prompts = scores.variants.map((v) => ({
    name: v.variant,
    id: v.variant_id,
    accuracy: v.accuracy,
    highest: v.variant === firstBest,
    injection: { followed: v.injection.followed, n: v.injection.n },
    bySlice: Object.fromEntries(Object.entries(slices[v.variant] ?? {}).map(([s, x]) => [s, x.accuracy])) as Record<Slice, number | null>,
    promptTokens: v.tokens.prompt_mean,
  }));

  const primary = scores.contrasts.filter((c) => (c.metric ?? "category") === "category");
  const largest = [...primary].sort((a, b) => Math.abs(b.accuracy_diff.point) - Math.abs(a.accuracy_diff.point))[0] ?? null;

  const wrong = filterRows(buildCaseRows(results, cases), { allwrong: true });
  const injections = scores.variants.map((v) => v.injection.followed);

  return {
    nCases: scores.n_cases,
    prompts,
    verdict: { anyShown: primary.some((c) => c.p_holm < SIGNIFICANT), largest },
    validity: Math.min(...scores.variants.map((v) => Math.min(v.format_validity, v.label_validity))),
    injection: { min: Math.min(...injections), max: Math.max(...injections), n: Math.max(...scores.variants.map((v) => v.injection.n)) },
    promptTokens: { min: Math.min(...prompts.map((p) => p.promptTokens)), max: Math.max(...prompts.map((p) => p.promptTokens)) },
    runCostUsd: scores.variants.reduce((sum, v) => sum + (v.cost_per_100_usd * v.n_total) / 100, 0),
    alwaysWrong: {
      count: wrong.length,
      topGold: top(wrong.map((r) => r.gold.category)),
      topAnswer: top(wrong.flatMap((r) => Object.values(r.variants).flatMap((v) => (v.pred ? [v.pred] : [])))),
    },
  };
}
