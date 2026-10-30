import { Check, X } from "lucide-react";
import Link from "next/link";
import type { CaseRow } from "@/core/views/cases";
import { VariantName } from "../Variant";

/** Tickets x variants. A check or a cross per variant, with the answer (or the failure code) under it. */
export function CaseTable({ rows, variants, rowHref }: { rows: CaseRow[]; variants: string[]; rowHref: (id: string) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <caption className="sr-only">Tickets and each variant&apos;s answer</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th scope="col" className="py-2 pr-3 font-normal">
              Ticket
            </th>
            <th scope="col" className="py-2 pr-3 font-normal">
              Text
            </th>
            <th scope="col" className="py-2 pr-3 font-normal">
              Gold
            </th>
            {variants.map((v) => (
              <th key={v} scope="col" className="py-2 pr-3 font-normal">
                <VariantName name={v} className="text-xs" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.case_id} className="border-b border-line align-top hover:bg-surface-2/60">
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                <Link id={`row-${r.case_id}`} href={rowHref(r.case_id)} scroll={false} className="font-mono text-primary underline-offset-2 hover:underline">
                  {r.case_id}
                </Link>
                <span className="mt-0.5 block text-xs text-muted">{r.slice.replace("_pair", "")}</span>
              </th>
              <td className="max-w-[22rem] py-2 pr-3">
                <span className="line-clamp-2 text-muted">{r.text}</span>
              </td>
              <td className="py-2 pr-3 font-mono text-xs">{r.gold.category}</td>
              {variants.map((v) => {
                const cell = r.variants[v];
                if (!cell) return <td key={v} className="py-2 pr-3 text-muted">—</td>;
                return (
                  <td key={v} className="py-2 pr-3 text-xs" data-testid={`cell-${r.case_id}-${v}`}>
                    <span className="flex items-center gap-1">
                      {cell.unscored ? (
                        <span className="text-warn">not scored</span>
                      ) : cell.correct ? (
                        <Check className="size-4 text-success" aria-label="right" />
                      ) : (
                        <X className="size-4 text-danger" aria-label="wrong" />
                      )}
                    </span>
                    <span className={`block font-mono ${cell.code ? "text-warn" : "text-muted"}`}>{cell.code ?? cell.pred}</span>
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
