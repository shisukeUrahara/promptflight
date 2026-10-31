import Link from "next/link";
import type { RunSummary } from "@/core/artifacts/runs";

/** "gpt-4o-mini-2024-07-18" → "gpt-4o-mini". */
export const shortModel = (model: string) => model.replace(/-\d{4}-\d{2}-\d{2}$/, "");

/**
 * One chip per holdout run, named by its model, so a visitor can switch model in one click.
 * Two runs of the same model are told apart by their date. Falls back to all runs when none is a holdout run.
 */
export function RunChips({ runs, current, basePath }: { runs: RunSummary[]; current: string; basePath: string }) {
  const holdout = runs.filter((r) => r.split === "holdout");
  const shown = holdout.length > 0 ? holdout : runs;
  const names = shown.map((r) => shortModel(r.model));
  return (
    <nav aria-label="Model" className="flex flex-wrap justify-center gap-2">
      {shown.map((r, i) => {
        const dup = names.indexOf(names[i]) !== names.lastIndexOf(names[i]);
        return (
          <Link
            key={r.id}
            href={`${basePath}?run=${r.id}`}
            aria-current={r.id === current ? "true" : undefined}
            className="rounded-full border border-line bg-surface/70 px-4 py-1.5 font-mono text-sm text-muted transition-colors hover:text-ink aria-[current=true]:border-ink aria-[current=true]:bg-ink aria-[current=true]:text-canvas"
          >
            {names[i]}
            {dup && <span className="ml-1 opacity-70">{r.created.slice(0, 10)}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
