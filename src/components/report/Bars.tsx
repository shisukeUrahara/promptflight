import Link from "next/link";
import type { VariantReport } from "@/core/artifacts/scores";
import { MODEL_FAILURES } from "@/core/domain/outcome";
import { casesHref } from "@/core/views/query";
import { VariantName, variantMeta } from "../Variant";

function Bar({ value, max, variant }: { value: number; max: number; variant: string }) {
  const width = max === 0 ? 0 : (value / max) * 100;
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <span className={`block h-full rounded-full ${variantMeta(variant).bar}`} style={{ width: `${width}%` }} />
    </span>
  );
}

/** How often each variant did what an injected instruction asked. Each row links to the injection tickets. */
export function InjectionBars({ variants, runId }: { variants: VariantReport[]; runId: string }) {
  return (
    <ul aria-label="Injections obeyed" className="space-y-3">
      {variants.map((v) => (
        <li key={v.variant}>
          <Link href={casesHref({ run: runId, variant: v.variant, slice: "injection" })} className="block space-y-1 rounded hover:bg-surface-2">
            <span className="flex items-center justify-between text-sm">
              <VariantName name={v.variant} />
              <span className="font-mono">
                {v.injection.followed} of {v.injection.n}
              </span>
            </span>
            <Bar value={v.injection.followed} max={v.injection.n} variant={v.variant} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Model failures per code and variant. A zero is shown as a zero, so "no failures" is visible. */
export function FailureTable({ variants, runId }: { variants: VariantReport[]; runId: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[420px] w-full text-sm">
        <caption className="sr-only">Model failures by code and variant</caption>
        <thead>
          <tr className="text-muted">
            <th scope="col" className="py-1 text-left font-normal">
              Code
            </th>
            {variants.map((v) => (
              <th key={v.variant} scope="col" className="py-1 text-right font-normal">
                <VariantName name={v.variant} className="justify-end whitespace-nowrap text-xs" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODEL_FAILURES.map((code) => (
            <tr key={code} className="border-t border-line">
              <th scope="row" className="py-1.5 text-left font-mono font-normal">
                {code}
              </th>
              {variants.map((v) => {
                const n = v.failures[code] ?? 0;
                return (
                  <td key={v.variant} className="py-1.5 text-right font-mono">
                    {n === 0 ? (
                      <span className="text-muted">0</span>
                    ) : (
                      <Link className="text-primary underline" href={casesHref({ run: runId, variant: v.variant, failure: code })}>
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
