import { mulberry32 } from "../dataset/rng";

export interface CiOptions {
  draws?: number;
  seed?: number;
  /** 0.95 gives the 2.5th and 97.5th percentiles. */
  level?: number;
}

export interface Ci {
  /** The statistic on the real data. */
  point: number;
  lo: number;
  hi: number;
}

export const DRAWS = 10_000;

/** Percentile with linear interpolation between neighbours, on a sorted array. */
export function quantile(sorted: readonly number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const i = Math.floor(pos);
  return i + 1 < sorted.length ? sorted[i] + (pos - i) * (sorted[i + 1] - sorted[i]) : sorted[i];
}

/**
 * Percentile bootstrap. Each draw picks n ticket indices with replacement, then
 * recomputes the statistic on that sample. Resampling tickets (not the numbers
 * the statistic is built from) is what makes this work for macro-F1, which is
 * not an average of per-ticket values.
 */
export function bootstrapCi<T>(items: readonly T[], statistic: (sample: T[]) => number, opts: CiOptions = {}): Ci {
  const { draws = DRAWS, seed = 0, level = 0.95 } = opts;
  const point = items.length === 0 ? 0 : statistic([...items]);
  if (items.length === 0) return { point, lo: 0, hi: 0 };

  const rng = mulberry32(seed);
  const n = items.length;
  const stats = new Array<number>(draws);
  for (let d = 0; d < draws; d++) {
    const sample = new Array<T>(n);
    for (let i = 0; i < n; i++) sample[i] = items[Math.floor(rng() * n)];
    stats[d] = statistic(sample);
  }
  stats.sort((a, b) => a - b);
  const tail = (1 - level) / 2;
  return { point, lo: quantile(stats, tail), hi: quantile(stats, 1 - tail) };
}

/**
 * CI of a statistic's difference (b minus a) between two variants run on the same tickets.
 * Both variants are resampled with the same ticket indices, so the ticket-to-ticket
 * variation that both share cancels out. That is why a paired interval is narrower.
 */
export function pairedBootstrapCi<A>(
  pairs: readonly { a: A; b: A }[],
  statistic: (sample: A[]) => number,
  opts: CiOptions = {},
): Ci {
  return bootstrapCi(pairs, (s) => statistic(s.map((p) => p.b)) - statistic(s.map((p) => p.a)), opts);
}
