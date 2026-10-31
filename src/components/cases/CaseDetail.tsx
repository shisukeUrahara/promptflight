import type { Case } from "@/core/domain/case";
import type { CaseResult } from "@/core/runner/types";
import { Pill } from "../ui/Pill";
import { VariantName, variantMeta } from "../Variant";

/** Everything about one ticket: the text, the truth, and every variant's raw answer. */
export function CaseDetail({ c, results }: { c: Case; results: CaseResult[] }) {
  const p = c.provenance;
  return (
    <>
      <section aria-label="Ticket">
        <h3 className="micro mb-2">Ticket</h3>
        <p className="whitespace-pre-wrap rounded-2xl border border-line bg-surface-2/60 p-4 leading-relaxed">{c.text}</p>
        <p className="mt-2 font-mono text-xs text-muted">
          {c.split} · {c.slice}
          {c.pair_id ? ` · ${c.pair_id}` : ""}
          {c.batch ? " · hard batch" : ""}
        </p>
      </section>
      <section aria-label="Gold label">
        <h3 className="micro mb-2">Gold label (blind human label)</h3>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 rounded-2xl border border-line p-4 font-mono text-xs">
          <dt className="text-muted">category</dt>
          <dd className="font-medium text-success">{c.gold.category}</dd>
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
              <dd className="text-danger">
                {c.injection.field} = {c.injection.value}
              </dd>
            </>
          )}
        </dl>
      </section>
      <section aria-label="Answers">
        <h3 className="micro mb-2">Answers</h3>
        <ul className="space-y-3">
          {results.map((r) => {
            const right = r.prediction?.category === c.gold.category;
            return (
              <li key={r.variant} className="rounded-2xl border border-line bg-surface-2/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <VariantName name={r.variant} />
                  <span className="flex flex-wrap gap-1.5">
                    <Pill mono tone={r.code ? "warn" : right ? "success" : "danger"}>{r.code ?? (right ? "right" : "wrong")}</Pill>
                    {r.usage && (
                      <Pill mono>
                        {r.usage.prompt_tokens}+{r.usage.completion_tokens} tok
                      </Pill>
                    )}
                    {r.latency_ms !== null && <Pill mono>{r.latency_ms} ms</Pill>}
                    {r.cached && <Pill mono>from cache</Pill>}
                  </span>
                </div>
                <pre className={`mt-3 overflow-x-auto whitespace-pre-wrap break-all rounded-xl border-l-2 bg-canvas/70 p-3 font-mono text-xs ${variantMeta(r.variant).border}`}>
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
