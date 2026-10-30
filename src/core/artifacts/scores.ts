import type { Pricing } from "../cost/pricing";
import type { Case } from "../domain/case";
import { INFRA_FAILURES } from "../domain/outcome";
import { bootstrapCi, pairedBootstrapCi, DRAWS, type Ci } from "../metrics/bootstrap";
import { accuracy, macroF1, type Scored } from "../metrics/classification";
import { holm, mcnemarExact, pairedCounts, type PairedCounts } from "../metrics/paired";
import { summarizeVariant, type VariantScores } from "../metrics/summary";
import type { CaseResult } from "../runner/types";

export const BOOTSTRAP_SEED = 20261029;

/** The four comparisons fixed before the holdout run. `b` is the treatment, `a` the baseline. */
export const CONTRASTS = [
  { id: "H1", a: "zero-json", b: "few-json", question: "Does few-shot help without strict output?" },
  { id: "H2", a: "zero-json", b: "zero-strict", question: "Does strict output help without few-shot?" },
  { id: "H3", a: "zero-strict", b: "few-strict", question: "Does few-shot help with strict output?" },
  { id: "H4", a: "few-json", b: "few-strict", question: "Does strict output help with few-shot?" },
] as const;

export interface VariantReport extends VariantScores {
  accuracy_ci: Pick<Ci, "lo" | "hi">;
  macro_f1_ci: Pick<Ci, "lo" | "hi">;
}

export interface ContrastReport {
  id: string;
  a: string;
  b: string;
  question: string;
  /** Tickets answered by both variants. Tickets where either had an infrastructure failure are left out. */
  n_pairs: number;
  counts: PairedCounts;
  /** Exact McNemar p-value, and the same after Holm over the contrasts in this run. */
  p: number;
  p_holm: number;
  /** Accuracy of b minus accuracy of a, with a paired bootstrap interval. */
  accuracy_diff: Ci;
}

/** Deterministic for the same results: no run id, no timestamps. */
export interface RunScores {
  split: string;
  model: string;
  n_cases: number;
  bootstrap: { draws: number; seed: number };
  variants: VariantReport[];
  contrasts: ContrastReport[];
}

const isInfra = (r: CaseResult) => r.code !== null && (INFRA_FAILURES as readonly string[]).includes(r.code);

export function buildScores(opts: { results: readonly CaseResult[]; cases: readonly Case[]; pricing: Pricing; model: string; split: string }): RunScores {
  const { results, cases, pricing, model, split } = opts;
  const byId = new Map(cases.map((c) => [c.case_id, c]));
  const names = [...new Set(results.map((r) => r.variant))];
  const rowsOf = (name: string) => results.filter((r) => r.variant === name);
  const ciOpts = { draws: DRAWS, seed: BOOTSTRAP_SEED };

  const variants: VariantReport[] = names.map((name) => {
    const rows = rowsOf(name);
    const summary = summarizeVariant(rows, cases, pricing, model);
    const items: Scored[] = rows.filter((r) => !isInfra(r)).map((r) => ({ gold: byId.get(r.case_id)!.gold.category, pred: r.prediction?.category ?? null }));
    const acc = bootstrapCi(items, accuracy, ciOpts);
    const f1 = bootstrapCi(items, macroF1, ciOpts);
    return { ...summary, accuracy_ci: { lo: acc.lo, hi: acc.hi }, macro_f1_ci: { lo: f1.lo, hi: f1.hi } };
  });

  const present = CONTRASTS.filter((c) => names.includes(c.a) && names.includes(c.b));
  const raw = present.map((c) => {
    const rowsA = new Map(rowsOf(c.a).map((r) => [r.case_id, r]));
    const pairs = rowsOf(c.b)
      .filter((rb) => rowsA.has(rb.case_id) && !isInfra(rb) && !isInfra(rowsA.get(rb.case_id)!))
      .map((rb) => {
        const gold = byId.get(rb.case_id)!.gold.category;
        const ra = rowsA.get(rb.case_id)!;
        return { a: { gold, pred: ra.prediction?.category ?? null } as Scored, b: { gold, pred: rb.prediction?.category ?? null } as Scored };
      });
    const counts = pairedCounts(pairs.map((p) => p.a.pred === p.a.gold), pairs.map((p) => p.b.pred === p.b.gold));
    return { c, n: pairs.length, counts, p: mcnemarExact(counts), diff: pairedBootstrapCi(pairs, accuracy, ciOpts) };
  });
  const adjusted = holm(raw.map((r) => r.p));
  const contrasts: ContrastReport[] = raw.map((r, i) => ({
    id: r.c.id,
    a: r.c.a,
    b: r.c.b,
    question: r.c.question,
    n_pairs: r.n,
    counts: r.counts,
    p: r.p,
    p_holm: adjusted[i],
    accuracy_diff: r.diff,
  }));

  return { split, model, n_cases: new Set(results.map((r) => r.case_id)).size, bootstrap: ciOpts, variants, contrasts };
}

export function scoresToCsv(scores: RunScores): string {
  const head = ["variant", "variant_id", "n_scored", "n_infra", "accuracy", "accuracy_lo", "accuracy_hi", "macro_f1", "macro_f1_lo", "macro_f1_hi", "priority_accuracy", "order_id_exact", "format_validity", "label_validity", "injection_followed", "injection_n", "prompt_tokens_mean", "completion_tokens_mean", "latency_p50_ms", "latency_p95_ms", "cost_per_100_usd"];
  const rows = scores.variants.map((v) =>
    [v.variant, v.variant_id, v.n_scored, v.n_infra, v.accuracy, v.accuracy_ci.lo, v.accuracy_ci.hi, v.macro_f1, v.macro_f1_ci.lo, v.macro_f1_ci.hi, v.priority_accuracy, v.order_id_exact, v.format_validity, v.label_validity, v.injection.followed, v.injection.n, v.tokens.prompt_mean, v.tokens.completion_mean, v.latency_ms.p50, v.latency_ms.p95, v.cost_per_100_usd].join(","),
  );
  return [head.join(","), ...rows].join("\n") + "\n";
}

const f = (x: number, d = 3) => x.toFixed(d);

/** A fixed-width table for the terminal. */
export function formatSummary(scores: RunScores): string[] {
  const head = ["variant", "N", "accuracy [95% CI]", "macro-F1", "format", "label", "inj.", "p95 ms", "$/100"];
  const body = scores.variants.map((v) => [
    v.variant,
    String(v.n_scored),
    `${f(v.accuracy)} [${f(v.accuracy_ci.lo)}, ${f(v.accuracy_ci.hi)}]`,
    f(v.macro_f1),
    f(v.format_validity),
    f(v.label_validity),
    `${v.injection.followed}/${v.injection.n}`,
    String(v.latency_ms.p95),
    f(v.cost_per_100_usd, 4),
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((r) => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ").trimEnd();
  const out = [line(head), line(widths.map((w) => "-".repeat(w))), ...body.map(line)];
  if (scores.contrasts.length > 0) {
    out.push("", "contrast (b minus a)        pairs  a-only  b-only  diff [95% CI]            p     p (Holm)");
    for (const c of scores.contrasts) {
      out.push(`${c.id} ${c.b} vs ${c.a}`.padEnd(27) + `${String(c.n_pairs).padEnd(7)}${String(c.counts.a_only).padEnd(8)}${String(c.counts.b_only).padEnd(8)}${f(c.accuracy_diff.point)} [${f(c.accuracy_diff.lo)}, ${f(c.accuracy_diff.hi)}]  ${f(c.p)}  ${f(c.p_holm)}`);
    }
  }
  return out;
}
