import type { Metadata } from "next";
import { connection } from "next/server";
import { Empty } from "@/components/StateViews";
import { KpiCards } from "@/components/report/KpiCards";
import { ManifestStrip } from "@/components/report/ManifestStrip";
import { RunPicker } from "@/components/report/RunPicker";
import { getRun, getRuns, pickRun } from "./data";

export const metadata: Metadata = { title: "Experiments" };

export default async function Page(props: PageProps<"/">) {
  await connection();
  const sp = await props.searchParams;
  const runs = getRuns();
  const current = pickRun(runs, typeof sp.run === "string" ? sp.run : undefined);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Experiments</h1>
          <p className="mt-1 text-muted">Which prompt won, by how much, and on which tickets.</p>
        </div>
        {current && (
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:max-w-xl">
            <RunPicker runs={runs} current={current.id} />
            <a href={`/runs/${current.id}/manifest`} className="shrink-0 text-sm text-primary underline-offset-2 hover:underline">
              Download manifest
            </a>
          </div>
        )}
      </header>
      {!current ? (
        <Empty title="No runs yet" hint="Run: pnpm pf run --split tuning" />
      ) : (
        <Report id={current.id} />
      )}
    </div>
  );
}

function Report({ id }: { id: string }) {
  const { manifest, scores } = getRun(id);
  return (
    <>
      <ManifestStrip m={manifest} />
      <KpiCards variants={scores.variants} runId={id} />
    </>
  );
}
