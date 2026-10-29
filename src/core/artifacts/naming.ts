const SPLIT_LABEL: Record<string, string> = { tuning: "Tuning set", holdout: "Holdout set" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/** `20261031T101500Z-holdout`. Sorts by time. */
export function runId(createdAt: Date, split: string): string {
  return `${createdAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}-${split}`;
}

/** `Holdout set · 4 variants · 31 Oct 2026 10:15 UTC`. Built by hand: strftime's %-d is not portable. */
export function runLabel(opts: { split: string; variantCount: number; createdAt: Date }): string {
  const d = opts.createdAt;
  const when = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  const n = opts.variantCount;
  return [SPLIT_LABEL[opts.split] ?? opts.split, `${n} variant${n === 1 ? "" : "s"}`, when].join(" · ");
}
