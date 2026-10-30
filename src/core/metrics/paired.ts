export interface PairedCounts {
  both_right: number;
  both_wrong: number;
  /** A right, B wrong. */
  a_only: number;
  /** B right, A wrong. */
  b_only: number;
}

/** Cross-tab of two variants on the same tickets. Four cells, so "tie" is never ambiguous. */
export function pairedCounts(a: readonly boolean[], b: readonly boolean[]): PairedCounts {
  if (a.length !== b.length) throw new Error(`variants differ in length: ${a.length} vs ${b.length}`);
  const out: PairedCounts = { both_right: 0, both_wrong: 0, a_only: 0, b_only: 0 };
  a.forEach((right, i) => {
    if (right && b[i]) out.both_right++;
    else if (!right && !b[i]) out.both_wrong++;
    else if (right) out.a_only++;
    else out.b_only++;
  });
  return out;
}

/**
 * Exact two-sided McNemar test. Only the tickets where the variants disagree matter.
 * Under "no difference" each of those n = b + c tickets is a fair coin flip, so
 * p = 2 * P(X <= min(b, c)) for X ~ Binomial(n, 1/2), capped at 1.
 */
export function mcnemarExact(counts: Pick<PairedCounts, "a_only" | "b_only">): number {
  const n = counts.a_only + counts.b_only;
  if (n === 0) return 1;
  const k = Math.min(counts.a_only, counts.b_only);
  let pmf = Math.pow(0.5, n);
  let cdf = pmf;
  for (let i = 0; i < k; i++) {
    pmf = (pmf * (n - i)) / (i + 1);
    cdf += pmf;
  }
  return Math.min(1, 2 * cdf);
}

/**
 * Holm step-down adjustment. Sort the p-values ascending, multiply the i-th smallest
 * by (m - i), keep the running maximum so the order is preserved, cap at 1.
 * Returns the adjusted values in the original order.
 */
export function holm(ps: readonly number[]): number[] {
  const m = ps.length;
  const order = ps.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p);
  const adjusted = new Array<number>(m);
  let running = 0;
  order.forEach(({ p, i }, rank) => {
    running = Math.max(running, Math.min(1, (m - rank) * p));
    adjusted[i] = running;
  });
  return adjusted;
}
