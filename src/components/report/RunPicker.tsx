import type { RunSummary } from "@/core/artifacts/runs";
import { AutoSubmitSelect } from "../AutoSubmitSelect";

export function RunPicker({ runs, current, action = "/results" }: { runs: RunSummary[]; current: string; action?: string }) {
  return (
    <form method="get" action={action} className="flex min-w-0 items-center gap-2">
      <label htmlFor="run" className="micro shrink-0">
        All runs
      </label>
      <AutoSubmitSelect
        id="run"
        name="run"
        defaultValue={current}
        className="min-w-0 max-w-full flex-1 truncate rounded-full border border-line bg-surface/80 px-4 py-2 text-sm"
      >
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label} (N={r.n})
          </option>
        ))}
      </AutoSubmitSelect>
      <noscript>
        <button className="rounded-lg border border-line px-3 py-2 text-sm">Show</button>
      </noscript>
    </form>
  );
}
