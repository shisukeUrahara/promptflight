import Link from "next/link";
import type { VariantReport } from "@/core/artifacts/scores";
import { casesHref } from "@/core/views/query";
import { fmt, ms, usd } from "../format";
import { DonutRing, RangeBar } from "../ui/charts";
import { VariantName, variantMeta } from "../Variant";

const pct1 = (v: number) => `${(v * 100).toFixed(1)}%`;

/** One card per prompt: accuracy as a ring, its 95% interval as a band, then the other measures. */
export function KpiCards({ variants, runId }: { variants: VariantReport[]; runId: string }) {
  return (
    <ul aria-label="Variants" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {variants.map((v, i) => {
        const meta = variantMeta(v.variant);
        return (
          <li
            key={v.variant}
            className="fade-up min-w-0 rounded-3xl border border-line bg-surface/85 p-5 shadow-card backdrop-blur-xl md:p-6"
            style={{ ["--delay" as string]: `${i * 60}ms` }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <VariantName name={v.variant} className="text-sm font-medium" />
                <p className="mt-1 font-mono text-xs text-muted">{v.variant_id}</p>
                <p className="display mt-3 text-3xl" data-testid={`acc-${v.variant}`}>
                  {pct1(v.accuracy)}
                </p>
                <p className="micro mt-1">category accuracy</p>
              </div>
              <DonutRing value={v.accuracy} label={`${v.variant} category accuracy`} colorClass={meta.text} size={72} />
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between font-mono text-xs text-muted">
                <span>95% CI</span>
                <span>
                  {(v.accuracy_ci.lo * 100).toFixed(1)}–{(v.accuracy_ci.hi * 100).toFixed(1)}
                </span>
              </div>
              <RangeBar lo={v.accuracy_ci.lo} hi={v.accuracy_ci.hi} point={v.accuracy} label={`${v.variant} accuracy`} barClass={meta.bar} />
            </div>
            <dl className="mt-5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-t border-line pt-4 text-sm">
              <dt className="text-muted">Macro-F1</dt>
              <dd className="num text-right font-mono">{fmt(v.macro_f1)}</dd>
              <dt className="text-muted">Priority</dt>
              <dd className="num text-right font-mono">{pct1(v.priority_accuracy)}</dd>
              <dt className="text-muted">Valid answers</dt>
              <dd className="num text-right font-mono">{pct1(Math.min(v.format_validity, v.label_validity))}</dd>
              <dt className="text-muted">Tricks obeyed</dt>
              <dd className={`num text-right font-mono ${v.injection.followed > 0 ? "text-danger" : ""}`}>
                {v.injection.followed}/{v.injection.n}
              </dd>
              <dt className="text-muted">Prompt tokens</dt>
              <dd className="num text-right font-mono">{Math.round(v.tokens.prompt_mean).toLocaleString("en-US")}</dd>
              <dt className="text-muted">p95 latency</dt>
              <dd className="num text-right font-mono">{ms(v.latency_ms.p95)}</dd>
              <dt className="text-muted">Per 100 tickets</dt>
              <dd className="num text-right font-mono">{usd(v.cost_per_100_usd)}</dd>
            </dl>
            <Link href={casesHref({ run: runId, variant: v.variant })} className="mt-4 inline-block text-sm text-brand underline-offset-2 hover:underline">
              See its tickets ›
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
