import Link from "next/link";
import type { PromptSummary } from "@/core/views/overview";
import { MiniBars } from "../ui/charts";
import { Pill } from "../ui/Pill";
import { VariantName, variantMeta } from "../Variant";

const SLICE_LABEL = { clear: "clear", ambiguous_pair: "ambig.", injection: "inject.", noisy: "noisy" } as const;

/** One card per prompt: big accuracy, accuracy by ticket type, tricks obeyed. The best one glows. */
export function PromptCards({ prompts, runId }: { prompts: PromptSummary[]; runId: string }) {
  return (
    <ul aria-label="Prompts" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {prompts.map((p, i) => (
        <li key={p.name} className="fade-up min-w-0" style={{ ["--delay" as string]: `${i * 60}ms` }}>
          <Link
            href={`/results?run=${runId}`}
            data-testid={`prompt-${p.name}`}
            className={`flex h-full flex-col rounded-3xl border bg-surface/85 p-5 shadow-card backdrop-blur-xl transition-colors hover:border-brand/50 md:p-6 ${
              p.highest ? "border-success/60 shadow-[0_0_48px_-16px_var(--success)]" : "border-line"
            }`}
          >
            <span className="flex items-center justify-between gap-2">
              <VariantName name={p.name} className="text-sm" />
              {p.highest && (
                <Pill tone="success" dot>
                  Highest
                </Pill>
              )}
            </span>
            <span className="display mt-6 text-5xl">
              {(p.accuracy * 100).toFixed(1)}
              <span className="text-2xl text-muted">%</span>
            </span>
            <span className="micro mt-2">category accuracy</span>
            <span className="mt-6 block">
              <MiniBars
                label={`${p.name} accuracy by ticket type`}
                values={(Object.keys(SLICE_LABEL) as (keyof typeof SLICE_LABEL)[]).map((s) => ({ label: SLICE_LABEL[s], value: p.bySlice[s] ?? 0 }))}
                max={1}
                barClass={`${variantMeta(p.name).bar} opacity-80`}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </span>
            <span className="mt-5 flex items-center justify-between border-t border-line pt-4 font-mono text-xs text-muted">
              <span>tricks obeyed</span>
              <span className={p.injection.followed > 0 ? "text-danger" : ""}>
                {p.injection.followed}/{p.injection.n}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
