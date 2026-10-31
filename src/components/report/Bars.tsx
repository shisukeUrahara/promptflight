import Link from "next/link";
import type { VariantReport } from "@/core/artifacts/scores";
import { MODEL_FAILURES } from "@/core/domain/outcome";
import { casesHref } from "@/core/views/query";
import { VariantName, variantMeta } from "../Variant";

/** How often each variant did what an injected instruction asked. Each row links to the injection tickets. */
export function InjectionBars({ variants, runId }: { variants: VariantReport[]; runId: string }) {
  return (
    <ul aria-label="Injections obeyed" className="space-y-2">
      {variants.map((v) => {
        const { followed, n } = v.injection;
        return (
          <li key={v.variant}>
            <Link
              href={casesHref({ run: runId, variant: v.variant, slice: "injection" })}
              className="block space-y-2 rounded-2xl border border-line bg-surface-2/50 p-3 transition-colors hover:border-danger/40"
            >
              <span className="flex items-center justify-between gap-2 text-sm">
                <VariantName name={v.variant} />
                <span className={`num font-mono ${followed > 0 ? "text-danger" : "text-muted"}`}>
                  {followed} of {n}
                </span>
              </span>
              <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <span className="block h-full rounded-full bg-danger" style={{ width: `${n === 0 ? 0 : (followed / n) * 100}%` }} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Model failures per code and variant. A zero is shown as a zero, so "no failures" is visible. */
export function FailureTable({ variants, runId }: { variants: VariantReport[]; runId: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <caption className="sr-only">Model failures by code and variant</caption>
        <thead>
          <tr>
            <th scope="col" className="micro pb-2 text-left font-normal">
              Code
            </th>
            {variants.map((v) => (
              <th key={v.variant} scope="col" className="pb-2 text-right align-bottom font-normal">
                <span className="inline-flex flex-col items-end gap-1">
                  <span aria-hidden className={`size-2 rounded-full ${variantMeta(v.variant).dot}`} />
                  <span className={`font-mono text-xs ${variantMeta(v.variant).ink}`}>{v.variant}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODEL_FAILURES.map((code) => (
            <tr key={code} className="border-t border-line">
              <th scope="row" className="py-2 text-left font-mono text-xs font-normal">
                {code}
              </th>
              {variants.map((v) => {
                const n = v.failures[code] ?? 0;
                return (
                  <td key={v.variant} className="py-2 text-right font-mono">
                    {n === 0 ? (
                      <span className="text-muted">0</span>
                    ) : (
                      <Link className="rounded-full bg-warn-bg px-2 py-0.5 text-warn underline-offset-2 hover:underline" href={casesHref({ run: runId, variant: v.variant, failure: code })}>
                        {n}
                      </Link>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
