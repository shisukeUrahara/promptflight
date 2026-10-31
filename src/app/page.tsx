import type { Metadata } from "next";
import { connection } from "next/server";
import { Hero } from "@/components/overview/Hero";
import { PromptCards } from "@/components/overview/PromptCards";
import { VerdictStrip } from "@/components/overview/VerdictStrip";
import { DEFAULT_SETUP, minDetectableEffect } from "@/core/metrics/power";
import { RunChips } from "@/components/overview/RunChips";
import { Empty } from "@/components/StateViews";
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
  const o = overviewStats(run.scores, run.results, getCases());

  return (
    <div className="space-y-16">
      <Hero prompts={o.prompts.length} tickets={o.nCases} chips={<RunChips runs={runs} current={current.id} basePath="/" />} />
      <PromptCards prompts={o.prompts} runId={current.id} />
      <VerdictStrip
        verdict={o.verdict}
        comparisons={run.scores.contrasts.filter((c) => (c.metric ?? "category") === "category").length}
        detectable={minDetectableEffect({ n: o.nCases, ...DEFAULT_SETUP }).mde}
        preregistered={run.manifest.preregistration_sha !== null}
        runId={current.id}
      />
    </div>
  );
}
