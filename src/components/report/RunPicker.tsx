import type { RunSummary } from "@/core/artifacts/runs";
import { AutoSubmitSelect } from "../AutoSubmitSelect";

export function RunPicker({ runs, current, action = "/" }: { runs: RunSummary[]; current: string; action?: string }) {
  return (
    <form method="get" action={action} className="flex min-w-0 items-center gap-2">
      <label htmlFor="run" className="shrink-0 text-sm text-muted">
        Run
      </label>
      <AutoSubmitSelect
        id="run"
        name="run"
        defaultValue={current}
        className="min-w-0 max-w-full flex-1 truncate rounded-lg border border-line bg-surface px-3 py-2 text-sm"
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
