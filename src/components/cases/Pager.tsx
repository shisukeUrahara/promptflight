import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

/** Server-rendered pager: plain links, so the page number lives in the URL. */
export function Pager({ total, pageSize, page, href, noun = "items" }: { total: number; pageSize: number; page: number; href: (page: number) => string; noun?: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const btn = "grid size-9 place-items-center rounded-full border border-line bg-surface/70 hover:bg-surface-2";
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="font-mono text-xs text-muted" aria-live="polite">
        Showing {from}–{to} of {total} {noun}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} aria-label="Previous page" className={btn}>
            <ChevronLeft className="size-4" aria-hidden />
          </Link>
        ) : (
          <span aria-hidden className={`${btn} opacity-40`}>
            <ChevronLeft className="size-4" />
          </span>
        )}
        <span className="font-mono text-xs">
          Page {page} of {pages}
        </span>
        {page < pages ? (
          <Link href={href(page + 1)} aria-label="Next page" className={btn}>
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        ) : (
          <span aria-hidden className={`${btn} opacity-40`}>
            <ChevronRight className="size-4" />
          </span>
        )}
      </div>
    </nav>
  );
}
