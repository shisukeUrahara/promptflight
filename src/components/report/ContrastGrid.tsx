import Link from "next/link";
import type { ContrastReport } from "@/core/artifacts/scores";
import { ci, fmt, signed } from "../format";
import { VariantName } from "../Variant";

export const SIGNIFICANT = 0.05;

/** Metric switch: plain links, so it works without JavaScript and the state is in the URL. */
export function MetricSwitch({ runId, metric }: { runId: string; metric: "category" | "priority" }) {
  const item = (m: "category" | "priority", label: string) => (
    <Link
      href={`/?run=${runId}${m === "priority" ? "&metric=priority" : ""}`}
      aria-current={metric === m ? "true" : undefined}
      className="rounded-md px-3 py-1.5 text-sm text-muted aria-[current=true]:bg-surface aria-[current=true]:font-medium aria-[current=true]:text-ink aria-[current=true]:shadow-card"
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Metric" className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5">
      {item("category", "Category (primary)")}
      {item("priority", "Priority (secondary)")}
    </nav>
  );
}

export function ContrastGrid({ contrasts }: { contrasts: ContrastReport[] }) {
  if (contrasts.length === 0) return <p className="text-sm text-muted">This run does not have both variants of any comparison.</p>;
  return (
    <ul aria-label="Comparisons" className="grid gap-3 sm:grid-cols-2">
      {contrasts.map((c) => {
        const shown = c.p_holm < SIGNIFICANT;
        return (
          <li key={c.id} className="min-w-0 rounded-lg border border-line p-4" data-testid={`contrast-${c.id}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-mono text-xs text-muted">{c.id}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${shown ? "bg-success-bg text-success" : "bg-surface-2 text-muted"}`}>
                {shown ? "shown" : "not shown"}
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
              <VariantName name={c.b} /> <span className="text-muted">vs</span> <VariantName name={c.a} />
            </p>
            <p className="mt-0.5 text-xs text-muted">{c.question}</p>
            <p className="mt-3 font-mono text-xl font-semibold">{signed(c.accuracy_diff.point)}</p>
            <p className="font-mono text-xs text-muted">{ci(c.accuracy_diff)} 95% CI, {c.metric} accuracy</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted">Only {c.a} right</dt>
              <dd className="text-right font-mono">{c.counts.a_only}</dd>
              <dt className="text-muted">Only {c.b} right</dt>
              <dd className="text-right font-mono">{c.counts.b_only}</dd>
              <dt className="text-muted">Both right / both wrong</dt>
              <dd className="text-right font-mono">
                {c.counts.both_right} / {c.counts.both_wrong}
              </dd>
              <dt className="text-muted">p (exact McNemar)</dt>
              <dd className="text-right font-mono">{fmt(c.p)}</dd>
              <dt className="text-muted">p after Holm</dt>
              <dd className="text-right font-mono">{fmt(c.p_holm)}</dd>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
