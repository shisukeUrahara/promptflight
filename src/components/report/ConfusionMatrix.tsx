import Link from "next/link";
import type { Confusion } from "@/core/metrics/classification";
import { casesHref } from "@/core/views/query";

const SHORT: Record<string, string> = {
  billing_refund: "refund",
  billing_dispute: "dispute",
  account_access: "access",
  account_security: "security",
  shipping_delay: "delay",
  shipping_damaged: "damaged",
  product_bug: "bug",
  feature_request: "feature",
  other: "other",
  failed: "failed",
};

/** Rows: the gold category. Columns: what the variant answered. Every non-empty cell links to its tickets. */
export function ConfusionMatrix({ confusion, runId, variant }: { confusion: Confusion; runId: string; variant: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[640px] border-separate border-spacing-1 text-xs">
        <caption className="sr-only">Confusion matrix for {variant}: rows are the gold category, columns the answer</caption>
        <thead>
          <tr>
            <th scope="col" className="micro p-1 text-left font-normal">
              gold ↓ / answer →
            </th>
            {confusion.columns.map((c) => (
              <th key={c} scope="col" className="p-1 text-center font-mono font-normal text-muted">
                <abbr title={c} className="no-underline">
                  {SHORT[c]}
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {confusion.rows.map((gold, r) => {
            const total = confusion.matrix[r].reduce((a, b) => a + b, 0);
            return (
              <tr key={gold}>
                <th scope="row" className="pr-2 text-left font-mono font-normal text-muted">
                  {gold}
                </th>
                {confusion.matrix[r].map((n, c) => {
                  const pred = confusion.columns[c];
                  const right = pred === gold;
                  const share = total === 0 ? 0 : n / total;
                  const tone = right ? "--success" : "--danger";
                  const style =
                    n === 0
                      ? undefined
                      : {
                          backgroundColor: `color-mix(in srgb, var(${tone}) ${Math.round(14 + share * 56)}%, transparent)`,
                          boxShadow: right && share >= 0.5 ? `0 0 18px -4px color-mix(in srgb, var(${tone}) 60%, transparent)` : undefined,
                        };
                  return (
                    <td key={pred} className="p-0 text-center font-mono">
                      {n === 0 ? (
                        <span className="block rounded-lg bg-surface-2/60 px-2 py-2 text-muted/40">·</span>
                      ) : (
                        <Link
                          href={casesHref({ run: runId, variant, gold, pred })}
                          style={style}
                          className="num block rounded-lg px-2 py-2 font-medium transition-transform hover:scale-105 hover:outline hover:outline-1 hover:outline-ink"
                          aria-label={`${n} tickets with gold ${gold} answered ${pred}`}
                        >
                          {n}
                        </Link>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
