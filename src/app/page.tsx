import type { Metadata } from "next";
import { connection } from "next/server";
import { Findings } from "@/components/overview/Findings";
import { FlowDiagram } from "@/components/overview/FlowDiagram";
import { Hero } from "@/components/overview/Hero";
import { PromptCards } from "@/components/overview/PromptCards";
import { VerdictStrip } from "@/components/overview/VerdictStrip";
import { DEFAULT_SETUP, minDetectableEffect } from "@/core/metrics/power";
import { RunChips, shortModel } from "@/components/overview/RunChips";
import { Empty } from "@/components/StateViews";
import { StatTile } from "@/components/ui/StatTile";
import { overviewStats } from "@/core/views/overview";
import { getCases, getRun, getRuns, pickRun } from "./data";

export const metadata: Metadata = { title: "Overview" };

export default async function Page(props: PageProps<"/">) {
  await connection();
  const sp = await props.searchParams;
  const runs = getRuns();
  const current = pickRun(runs, typeof sp.run === "string" ? sp.run : undefined);
  if (!current) {
    return (
      <div className="space-y-6">
        <h1 className="display text-5xl">PromptFlight</h1>
        <Empty title="No runs yet" hint="Run: pnpm pf run --split tuning" />
      </div>
    );
  }
  const run = getRun(current.id);
  const cases = getCases();
  const o = overviewStats(run.scores, run.results, cases);
  const detectable = minDetectableEffect({ n: o.nCases, ...DEFAULT_SETUP }).mde;

  return (
    <div className="space-y-16">
      <Hero prompts={o.prompts.length} tickets={o.nCases} chips={<RunChips runs={runs} current={current.id} basePath="/" />} />
      <PromptCards prompts={o.prompts} runId={current.id} />
      <VerdictStrip
        verdict={o.verdict}
        comparisons={run.scores.contrasts.filter((c) => (c.metric ?? "category") === "category").length}
        detectable={detectable}
        preregistered={run.manifest.preregistration_sha !== null}
        runId={current.id}
      />
      <FlowDiagram tickets={cases.length} prompts={o.prompts.map((p) => p.name)} model={shortModel(run.manifest.model)} />
      <Findings o={o} runId={current.id} detectable={detectable} />
      <section aria-label="Facts" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile value={`${Math.round(o.validity * 100)}%`} label="valid answers" />
        <StatTile value={`${o.injection.min}–${o.injection.max} of ${o.injection.n}`} label="hidden instructions obeyed" tone={o.injection.max > 0 ? "danger" : "ink"} />
        <StatTile value={`${Math.round(o.promptTokens.min).toLocaleString("en-US")} → ${Math.round(o.promptTokens.max).toLocaleString("en-US")}`} label="prompt tokens per ticket" />
        <StatTile value={`$${o.runCostUsd.toFixed(2)}`} label="cost of this run" />
      </section>
    </div>
  );
}
