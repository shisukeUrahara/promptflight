"use client";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * A native modal <dialog>: showModal() makes the rest of the page inert, so focus stays inside,
 * and Esc closes it. Closing goes back to the list URL and returns focus to the ticket's link.
 */
export function CaseDrawer({ title, closeHref, ticketId, children }: { title: string; closeHref: string; ticketId: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal?.();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      // Runs when the list re-renders without the dialog, so the ticket link exists again.
      // The table and the phone cards both link the ticket; focus the one on screen.
      setTimeout(() => [...document.querySelectorAll<HTMLElement>(`[data-ticket="${ticketId}"]`)].find((e) => e.offsetParent !== null)?.focus(), 0);
    };
  }, [ticketId]);

  const close = () => router.replace(closeHref, { scroll: false });

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === ref.current && close()}
      className="ml-auto mr-0 h-full max-h-none w-full max-w-2xl border-l border-line bg-surface/95 p-0 text-ink shadow-card backdrop-blur-xl backdrop:bg-canvas/60 backdrop:backdrop-blur-sm md:rounded-l-3xl"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="font-mono text-lg">{title}</h2>
          <button type="button" onClick={close} aria-label="Close" className="grid size-9 place-items-center rounded-full border border-line hover:bg-surface-2">
            <X className="size-4" aria-hidden />
          </button>
        </header>
        {/* Focusable so keyboard users can scroll it when it overflows. */}
        <div tabIndex={0} className="flex-1 space-y-6 overflow-y-auto px-6 py-5 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">{children}</div>
      </div>
    </dialog>
  );
}
