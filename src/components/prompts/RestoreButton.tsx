"use client";
import { useState, useTransition } from "react";
import { restorePrompt } from "@/app/prompts/actions";

export function RestoreButton({ name, id, disabled }: { name: string; id: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => start(async () => {
          const r = await restorePrompt({ name, id });
          setError(r.ok ? null : r.error);
        })}
        className="rounded-md border border-line px-2 py-0.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Restoring…" : "Restore"}
      </button>
      {error && <span role="alert" className="block text-xs text-danger">{error}</span>}
    </>
  );
}
