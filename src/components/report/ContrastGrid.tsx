import Link from "next/link";
import type { ContrastReport } from "@/core/artifacts/scores";
import { casesHref } from "@/core/views/query";
import { fmt } from "../format";
import { SplitBar } from "../ui/charts";
import { Pill } from "../ui/Pill";
import { variantMeta } from "../Variant";

export const SIGNIFICANT = 0.05;

/** Category / priority switch as a segmented pill. Plain links, so the state lives in the URL. */
export function MetricSwitch({ runId, metric }: { runId: string; metric: "category" | "priority" }) {
  const item = (m: "category" | "priority", label: string) => (
    <Link
      href={`/results?run=${runId}${m === "priority" ? "&metric=priority" : ""}`}
      aria-current={metric === m ? "true" : undefined}
      className="rounded-full px-4 py-1.5 text-sm text-muted transition-colors hover:text-ink aria-[current=true]:bg-surface-2 aria-[current=true]:font-medium aria-[current=true]:text-ink aria-[current=true]:shadow-card"
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Metric" className="inline-flex rounded-full border border-line bg-surface/70 p-1">
      {item("category", "Category · primary")}
      {item("priority", "Priority · secondary")}
    </nav>
  );
}

const pts = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)} pts`;

/** The pre-registered comparisons as incident cards: id, verdict, three numbers, the paired split. */
export function ContrastGrid({ contrasts, runId }: { contrasts: ContrastReport[]; runId: string }) {
  if (contrasts.length === 0) return <p className="text-sm text-muted">This run does not have both variants of any comparison.</p>;
  return (
    <ul aria-label="Comparisons" className="grid gap-4 lg:grid-cols-2">
      {contrasts.map((c, i) => {
        const shown = c.p_holm < SIGNIFICANT;
        const d = c.accuracy_diff.point;
        return (
          <li
            key={c.id}
            data-testid={`contrast-${c.id}`}
            className="fade-up flex min-w-0 flex-col rounded-3xl border border-line bg-surface/85 p-5 shadow-card backdrop-blur-xl md:p-6"
            style={{ ["--delay" as string]: `${i * 50}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Pill mono>{c.id}</Pill>
                <span className="truncate font-mono text-sm">
                  {c.b} vs {c.a}
                </span>
              </div>
              <Pill tone={shown ? "success" : "neutral"}>{shown ? "Shown" : "Not shown"}</Pill>
            </div>
            <p className="mt-2 text-sm text-muted">{c.question}</p>
            <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-line py-4">
              <div>
                <dt className="micro">Difference</dt>
                <dd className={`num mt-1 whitespace-nowrap font-mono text-lg ${d > 0 ? "text-success" : d < 0 ? "text-danger" : ""}`}>{pts(d)}</dd>
              </div>
              <div>
                <dt className="micro">p (McNemar)</dt>
                <dd className="num mt-1 font-mono text-lg">{fmt(c.p)}</dd>
              </div>
              <div>
                <dt className="micro">After Holm</dt>
                <dd className="num mt-1 font-mono text-lg">{fmt(c.p_holm)}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <SplitBar
                a={c.counts.a_only}
                b={c.counts.b_only}
                aLabel={`only ${c.a}`}
                bLabel={`only ${c.b}`}
                aClass={variantMeta(c.a).bar}
                bClass={variantMeta(c.b).bar}
              />
              <p className="mt-2 font-mono text-xs text-muted">
                both right {c.counts.both_right} · both wrong {c.counts.both_wrong} · 95% CI {pts(c.accuracy_diff.lo)} to {pts(c.accuracy_diff.hi)}
              </p>
            </div>
            <Link href={casesHref({ run: runId, disagree: true })} className="mt-auto pt-4 text-sm text-brand underline-offset-2 hover:underline">
              View tickets ›
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
