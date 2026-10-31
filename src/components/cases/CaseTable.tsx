import { Check, X } from "lucide-react";
import Link from "next/link";
import type { CaseRow, VariantCell } from "@/core/views/cases";
import { variantMeta } from "../Variant";

function Mark({ cell }: { cell: VariantCell }) {
  if (cell.unscored) return <span className="text-warn">not scored</span>;
  return cell.correct ? (
    <span className="grid size-5 place-items-center rounded-full bg-success-bg">
      <Check className="size-3.5 text-success" aria-label="right" />
    </span>
  ) : (
    <span className="grid size-5 place-items-center rounded-full bg-danger-bg">
      <X className="size-3.5 text-danger" aria-label="wrong" />
    </span>
  );
}

/**
 * Tickets x variants: a table from 768 px, one card per ticket below that.
 * Both carry data-ticket so the dialog can hand focus back to whichever one is on screen.
 */
export function CaseTable({ rows, variants, rowHref }: { rows: CaseRow[]; variants: string[]; rowHref: (id: string) => string }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">Tickets and each variant&apos;s answer</caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="micro py-3 pr-3 font-normal">
                Ticket
              </th>
              <th scope="col" className="micro py-3 pr-3 font-normal">
                Text
              </th>
              <th scope="col" className="micro py-3 pr-3 font-normal">
                Gold
              </th>
              {variants.map((v) => (
                <th key={v} scope="col" className="py-3 pr-3 text-left align-bottom font-normal">
                  <span className="inline-flex flex-col gap-1">
                    <span aria-hidden className={`size-2 rounded-full ${variantMeta(v).dot}`} />
                    <span className={`font-mono text-xs ${variantMeta(v).ink}`}>{v}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.case_id} className="border-b border-line align-top transition-colors last:border-0 hover:bg-surface-2/60">
                <th scope="row" className="py-3 pr-3 text-left font-normal">
                  <Link id={`row-${r.case_id}`} data-ticket={r.case_id} href={rowHref(r.case_id)} scroll={false} className="font-mono text-brand underline-offset-2 hover:underline">
                    {r.case_id}
                  </Link>
                  <span className="micro mt-1 block">{r.slice.replace("_pair", "")}</span>
                </th>
                <td className="max-w-[22rem] py-3 pr-3">
                  <span className="line-clamp-2 text-muted">{r.text}</span>
                </td>
                <td className="py-3 pr-3 font-mono text-xs">{r.gold.category}</td>
                {variants.map((v) => {
                  const cell = r.variants[v];
                  if (!cell) return <td key={v} className="py-3 pr-3 text-muted">—</td>;
                  return (
                    <td key={v} className="py-3 pr-3 text-xs" data-testid={`cell-${r.case_id}-${v}`}>
                      <Mark cell={cell} />
                      <span className={`mt-1 block font-mono ${cell.code ? "text-warn" : "text-muted"}`}>{cell.code ?? cell.pred}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label="Tickets" className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={r.case_id} className="rounded-2xl border border-line bg-surface-2/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <Link data-ticket={r.case_id} href={rowHref(r.case_id)} scroll={false} className="font-mono text-brand underline-offset-2 hover:underline">
                {r.case_id}
              </Link>
              <span className="micro">{r.slice.replace("_pair", "")}</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-muted">{r.text}</p>
            <p className="mt-2 font-mono text-xs">gold {r.gold.category}</p>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {variants.map((v) => {
                const cell = r.variants[v];
                return (
                  <li key={v} className="flex min-w-0 items-center gap-2 text-xs">
                    {cell ? <Mark cell={cell} /> : <span className="text-muted">—</span>}
                    <span className={`truncate font-mono ${variantMeta(v).ink}`}>{v}</span>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}
