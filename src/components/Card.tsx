import type { ReactNode } from "react";

export function Card({ title, hint, children, className = "" }: { title?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`min-w-0 rounded-lg border border-line bg-surface p-4 shadow-card md:p-5 ${className}`}>
      {title && (
        <header className="mb-3">
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
