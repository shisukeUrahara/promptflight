import { Info, Trophy } from "lucide-react";
import Link from "next/link";
import type { Overview } from "@/core/views/overview";
import { Pill } from "../ui/Pill";

const pts = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)} points`;

/** One sentence on who won, with the numbers behind it. Everything is computed from the run. */
export function VerdictStrip({ verdict, comparisons, detectable, preregistered, runId }: {
  verdict: Overview["verdict"];
  comparisons: number;
  /** Smallest accuracy gap the run could detect (pf power), or null if none. */
  detectable: number | null;
  preregistered: boolean;
  runId: string;
}) {
  const c = verdict.largest;
  const Icon = verdict.anyShown ? Trophy : Info;
  return (
    <section aria-label="Verdict" className="fade-up flex flex-col gap-4 rounded-3xl border border-line bg-surface/85 p-5 shadow-card backdrop-blur-xl md:flex-row md:items-center md:p-6">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-line bg-surface-2 text-muted">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-medium">{verdict.anyShown ? "One prompt wins on this run." : "No prompt wins clearly."}</p>
        {c && (
          <p className="mt-1 text-sm text-muted">
            Largest gap {pts(c.accuracy_diff.point)} ({c.b} vs {c.a}). After correcting for {comparisons} comparisons, p = {c.p_holm.toFixed(3)}.
            {detectable !== null && ` The test could detect about ${Math.round(detectable * 100)} points.`}{" "}
            <Link href={`/results?run=${runId}`} className="text-brand underline-offset-2 hover:underline">
              See all comparisons
            </Link>
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {preregistered && <Pill tone="brand">Pre-registered</Pill>}
        <Pill tone={verdict.anyShown ? "success" : "neutral"}>{verdict.anyShown ? "Significant difference" : "No significant difference"}</Pill>
      </div>
    </section>
  );
}
