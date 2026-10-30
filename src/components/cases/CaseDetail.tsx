import type { Case } from "@/core/domain/case";
import type { CaseResult } from "@/core/runner/types";
import { VariantName } from "../Variant";

/** Everything about one ticket: the text, the truth, and every variant's raw answer. */
export function CaseDetail({ c, results }: { c: Case; results: CaseResult[] }) {
  const p = c.provenance;
  return (
    <>
      <section aria-label="Ticket">
        <h3 className="mb-1 text-xs uppercase tracking-wide text-muted">Ticket</h3>
        <p className="whitespace-pre-wrap rounded-lg border border-line bg-canvas p-3">{c.text}</p>
        <p className="mt-1 text-xs text-muted">
          {c.split} · {c.slice}
          {c.pair_id ? ` · ${c.pair_id}` : ""}
          {c.batch ? " · hard batch" : ""}
        </p>
      </section>
      <section aria-label="Gold label">
        <h3 className="mb-1 text-xs uppercase tracking-wide text-muted">Gold label (blind human label)</h3>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 font-mono text-xs">
          <dt className="text-muted">category</dt>
          <dd>{c.gold.category}</dd>
          <dt className="text-muted">priority</dt>
          <dd>{c.gold.priority}</dd>
          <dt className="text-muted">order_id</dt>
          <dd>{c.gold.order_id ?? "null"}</dd>
          <dt className="text-muted">drafter aimed for</dt>
          <dd>
            {p.intended.category} / {p.intended.priority}
          </dd>
          {c.injection && (
            <>
              <dt className="text-muted">injection asks for</dt>
              <dd>
                {c.injection.field} = {c.injection.value}
              </dd>
            </>
          )}
        </dl>
      </section>
      <section aria-label="Answers">
        <h3 className="mb-2 text-xs uppercase tracking-wide text-muted">Answers</h3>
        <ul className="space-y-3">
          {results.map((r) => {
            const right = r.prediction?.category === c.gold.category;
            return (
              <li key={r.variant} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <VariantName name={r.variant} />
                  <span className="flex flex-wrap gap-1.5 font-mono text-xs">
                    <span className={`rounded px-1.5 py-0.5 ${r.code ? "bg-warn-bg text-warn" : right ? "bg-success-bg text-success" : "bg-danger-bg text-danger"}`}>
                      {r.code ?? (right ? "right" : "wrong")}
                    </span>
                    {r.usage && <span className="rounded bg-surface-2 px-1.5 py-0.5">{r.usage.prompt_tokens}+{r.usage.completion_tokens} tok</span>}
                    {r.latency_ms !== null && <span className="rounded bg-surface-2 px-1.5 py-0.5">{r.latency_ms} ms</span>}
                    {r.cached && <span className="rounded bg-surface-2 px-1.5 py-0.5">from cache</span>}
                  </span>
                </div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded bg-canvas p-2 font-mono text-xs">
                  {r.raw ? (r.raw.refusal ?? r.raw.content ?? "(empty)") : `no answer: ${r.detail ?? r.code}`}
                </pre>
                {r.detail && r.code && <p className="mt-1 text-xs text-warn">{r.detail}</p>}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
