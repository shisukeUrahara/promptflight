import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Not found" };

const PAGES = [
  ["/", "Overview"],
  ["/results", "Results"],
  ["/cases", "Tickets"],
  ["/prompts", "Prompts"],
] as const;

export default function NotFound() {
  return (
    <div className="fade-up py-10 text-center">
      <p className="display text-7xl text-brand md:text-8xl">404</p>
      <h1 className="mt-4 text-xl font-medium">Page not found</h1>
      <p className="mt-2 text-muted">There is no page at this address. Try one of these.</p>
      <nav aria-label="Pages" className="mt-6 flex flex-wrap justify-center gap-2">
        {PAGES.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full border border-line bg-surface/70 px-4 py-1.5 text-sm hover:bg-surface-2">
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
