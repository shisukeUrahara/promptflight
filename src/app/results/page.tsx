import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Card } from "@/components/Card";
import { Empty } from "@/components/StateViews";
import { FailureTable, InjectionBars } from "@/components/report/Bars";
import { ConfusionMatrix } from "@/components/report/ConfusionMatrix";
import { ContrastGrid, MetricSwitch } from "@/components/report/ContrastGrid";
import { KpiCards } from "@/components/report/KpiCards";
import { ManifestStrip } from "@/components/report/ManifestStrip";
import { RunPicker } from "@/components/report/RunPicker";
import { getRun, getRuns, pickRun } from "../data";

export const metadata: Metadata = { title: "Results" };

export default async function Page(props: PageProps<"/results">) {
  await connection();
  const sp = await props.searchParams;
  const runs = getRuns();
  const current = pickRun(runs, typeof sp.run === "string" ? sp.run : undefined);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Results</h1>
          <p className="mt-1 text-muted">Which prompt won, by how much, and on which tickets.</p>
        </div>
        {current && (
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:max-w-xl">
            <RunPicker runs={runs} current={current.id} />
            <a href={`/runs/${current.id}/manifest`} className="shrink-0 text-sm text-brand underline-offset-2 hover:underline">
              Download manifest
            </a>
          </div>
        )}
      </header>
      {!current ? (
        <Empty title="No runs yet" hint="Run: pnpm pf run --split tuning" />
      ) : (
        <Report id={current.id} metric={sp.metric === "priority" ? "priority" : "category"} variant={typeof sp.variant === "string" ? sp.variant : undefined} />
      )}
    </div>
  );
}

function Report({ id, metric, variant }: { id: string; metric: "category" | "priority"; variant?: string }) {
  const { manifest, scores } = getRun(id);
  const contrasts = scores.contrasts.filter((c) => (c.metric ?? "category") === metric);
  const shown = scores.variants.find((v) => v.variant === variant) ?? scores.variants[0];
  const anyShown = contrasts.some((c) => c.p_holm < 0.05);
  return (
    <>
      <ManifestStrip m={manifest} />
      <KpiCards variants={scores.variants} runId={id} />
      <Card
        title="Pre-registered comparisons"
        hint={
          <>
            Exact McNemar on the tickets both variants answered, Holm-corrected within each family. A difference counts as{" "}
            <em>shown</em> only when the corrected p is below 0.05.{" "}
            {!anyShown && <strong className="font-medium text-ink">No difference is shown in this run.</strong>}
          </>
        }
      >
        <div className="mb-4">
          <MetricSwitch runId={id} metric={metric} />
        </div>
        <ContrastGrid contrasts={contrasts} />
      </Card>
      <div className="grid gap-6 xl:grid-cols-[3fr_2fr]">
        <Card title="Confusion matrix" hint="Rows are the gold category, columns the answer. Select a cell to see its tickets.">
          <nav aria-label="Matrix variant" className="mb-3 flex flex-wrap gap-2">
            {scores.variants.map((v) => (
              <Link
                key={v.variant}
                href={`/results?run=${id}${metric === "priority" ? "&metric=priority" : ""}&variant=${v.variant}`}
                aria-current={v.variant === shown.variant ? "true" : undefined}
                className="rounded-full border border-line px-3 py-1 text-xs aria-[current=true]:bg-surface-2 aria-[current=true]:font-medium"
              >
                {v.variant}
              </Link>
            ))}
          </nav>
          <ConfusionMatrix confusion={shown.confusion} runId={id} variant={shown.variant} />
        </Card>
        <div className="space-y-6">
          <Card title="Injections obeyed" hint="Tickets that tell the model to change its answer, where the answer changed that way.">
            <InjectionBars variants={scores.variants} runId={id} />
          </Card>
          <Card title="Model failures" hint="Answers that broke the contract. They count as wrong.">
            <FailureTable variants={scores.variants} runId={id} />
          </Card>
        </div>
      </div>
    </>
  );
}
