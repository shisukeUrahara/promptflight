import Link from "next/link";
import type { VariantReport } from "@/core/artifacts/scores";
import { casesHref } from "@/core/views/query";
import { ci, fmt, ms, usd } from "../format";
import { VariantName } from "../Variant";

export function KpiCards({ variants, runId }: { variants: VariantReport[]; runId: string }) {
  return (
    <ul aria-label="Variants" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {variants.map((v) => (
        <li key={v.variant} className="min-w-0 rounded-lg border border-line bg-surface p-4 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <VariantName name={v.variant} className="text-sm font-medium" />
            <span className="font-mono text-xs text-muted">{v.variant_id}</span>
          </div>
          <p className="mt-3 text-xs uppercase tracking-wide text-muted">Category accuracy</p>
          <p className="font-mono text-2xl font-semibold" data-testid={`acc-${v.variant}`}>
            {fmt(v.accuracy)}
          </p>
          <p className="font-mono text-xs text-muted">{ci(v.accuracy_ci)} 95% CI</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted">Macro-F1</dt>
            <dd className="text-right font-mono">{fmt(v.macro_f1)}</dd>
            <dt className="text-muted">Priority</dt>
            <dd className="text-right font-mono">{fmt(v.priority_accuracy)}</dd>
            <dt className="text-muted">Valid format</dt>
            <dd className="text-right font-mono">{fmt(v.format_validity)}</dd>
            <dt className="text-muted">Valid labels</dt>
            <dd className="text-right font-mono">{fmt(v.label_validity)}</dd>
            <dt className="text-muted">Injections obeyed</dt>
            <dd className="text-right font-mono">
              {v.injection.followed}/{v.injection.n}
            </dd>
            <dt className="text-muted">Prompt tokens</dt>
            <dd className="text-right font-mono">{Math.round(v.tokens.prompt_mean).toLocaleString("en-US")}</dd>
            <dt className="text-muted">p95 latency</dt>
            <dd className="text-right font-mono">{ms(v.latency_ms.p95)}</dd>
            <dt className="text-muted">Per 100 tickets</dt>
            <dd className="text-right font-mono">{usd(v.cost_per_100_usd)}</dd>
          </dl>
          <Link href={casesHref({ run: runId, variant: v.variant })} className="mt-3 inline-block text-sm text-primary underline-offset-2 hover:underline">
            See its tickets
          </Link>
        </li>
      ))}
    </ul>
  );
}
