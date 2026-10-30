"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export const LINKS = [
  { href: "/", label: "Experiments" },
  { href: "/cases", label: "Cases" },
  { href: "/prompts", label: "Prompts" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" onClick={() => setOpen(false)}>
          <Logo />
          <span className="font-display text-[17px]">PromptFlight</span>
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 text-sm md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(path, l.href) ? "page" : undefined}
              className="rounded-lg px-3 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink aria-[current=page]:bg-surface-2 aria-[current=page]:font-medium aria-[current=page]:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg border border-line md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line px-4 pb-4 md:hidden">
          <ul className="flex flex-col pt-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(path, l.href) ? "page" : undefined}
                  className="block rounded-lg px-3 py-2.5 text-sm aria-[current=page]:bg-surface-2 aria-[current=page]:font-medium"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
