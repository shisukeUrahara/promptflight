"use client";
import { BarChart3, FileCode2, LayoutGrid, Search, Ticket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export const LINKS = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/results", label: "Results", icon: BarChart3 },
  { href: "/cases", label: "Tickets", icon: Ticket },
  { href: "/prompts", label: "Prompts", icon: FileCode2 },
];

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path.startsWith(href));

/** Top bar with centred pill tabs (desktop) and a bottom tab bar (phone). */
export function Nav() {
  const path = usePathname();
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/60 bg-canvas/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 font-display text-[17px] font-semibold tracking-tight">
            <Logo />
            PromptFlight
          </Link>
          <nav aria-label="Main" className="mx-auto hidden rounded-full border border-line bg-surface/70 p-1 md:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                aria-current={isActive(path, l.href) ? "page" : undefined}
                className="rounded-full px-4 py-1.5 text-sm text-muted transition-colors hover:text-ink aria-[current=page]:bg-surface-2 aria-[current=page]:font-medium aria-[current=page]:text-ink aria-[current=page]:shadow-card"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <form method="get" action="/cases" role="search" className="hidden lg:block">
              <label className="flex h-10 w-56 items-center gap-2 rounded-full border border-line bg-surface/70 px-4 text-sm text-muted focus-within:border-brand">
                <Search className="size-4 shrink-0" aria-hidden />
                <span className="sr-only">Search tickets</span>
                <input name="q" type="search" placeholder="Search tickets" className="w-full bg-transparent text-ink placeholder:text-muted focus:outline-none" />
              </label>
            </form>
            <Link
              href="/cases"
              aria-label="Search tickets"
              className="grid size-10 place-items-center rounded-full border border-line bg-surface/70 text-muted hover:text-ink lg:hidden"
            >
              <Search className="size-4" aria-hidden />
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <nav aria-label="Mobile" className="fixed inset-x-0 bottom-0 z-30 border-t border-line/60 bg-canvas/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(path, l.href) ? "page" : undefined}
                  className="flex flex-col items-center gap-1 py-2.5 text-[11px] text-muted aria-[current=page]:font-medium aria-[current=page]:text-brand"
                >
                  <Icon className="size-5" aria-hidden />
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
