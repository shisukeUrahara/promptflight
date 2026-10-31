import { Inbox } from "lucide-react";

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-surface/50 p-10 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-brand-bg">
        <Inbox aria-hidden className="size-5 text-brand" />
      </span>
      <p className="mt-4 font-medium">{title}</p>
      {hint && <p className="mt-1 font-mono text-sm text-muted">{hint}</p>}
    </div>
  );
}
