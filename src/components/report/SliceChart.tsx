import Link from "next/link";
import type { SliceScore } from "@/core/metrics/slices";
import { SLICES, type Slice } from "@/core/domain/labels";
import { casesHref } from "@/core/views/query";
import { variantMeta } from "../Variant";

const LABEL: Record<Slice, string> = { clear: "Clear", ambiguous_pair: "Ambiguous", injection: "Hidden instruction", noisy: "Noisy" };

/** Category accuracy per ticket type: one row per type, one bar per prompt. */
export function SliceChart({ bySlice, runId }: { bySlice: Record<string, Record<Slice, SliceScore>>; runId: string }) {
  const variants = Object.keys(bySlice);
  return (
    <ul aria-label="Accuracy by ticket type" className="grid gap-6 md:grid-cols-2">
      {SLICES.map((s) => {
        const n = bySlice[variants[0]]?.[s].n ?? 0;
        return (
          <li key={s} data-testid={`slice-${s}`} className="min-w-0">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <Link href={casesHref({ run: runId, slice: s })} className="text-sm font-medium underline-offset-2 hover:underline">
                {LABEL[s]}
              </Link>
              <span className="micro">{n} tickets</span>
            </div>
            <ul className="space-y-1.5">
              {variants.map((v) => {
                const a = bySlice[v][s].accuracy;
                const meta = variantMeta(v);
                return (
                  <li key={v} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-2" aria-label={`${v}: ${a === null ? "no tickets" : `${(a * 100).toFixed(1)}%`}`}>
                    <span className={`truncate font-mono text-xs ${meta.text}`}>{v}</span>
                    <span aria-hidden className="h-2 overflow-hidden rounded-full bg-surface-2">
                      <span className={`block h-full rounded-full ${meta.bar}`} style={{ width: `${(a ?? 0) * 100}%` }} />
                    </span>
                    <span aria-hidden className="num text-right font-mono text-xs">{a === null ? "–" : `${(a * 100).toFixed(1)}%`}</span>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
