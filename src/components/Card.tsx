import type { ReactNode } from "react";

/** The v2 glass card: translucent surface over the aurora glow, hairline border, 24px radius. */
export function Card({
  title,
  hint,
  action,
  children,
  className = "",
}: {
  title?: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      className={`min-w-0 rounded-3xl border border-line bg-surface/85 p-5 shadow-card backdrop-blur-xl md:p-6 ${className}`}
    >
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="font-display text-base font-semibold">{title}</h2>}
            {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
