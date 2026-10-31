import type { ReactNode } from "react";

export type Tone = "neutral" | "brand" | "success" | "warn" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  brand: "bg-brand-bg text-brand",
  success: "bg-success-bg text-success",
  warn: "bg-warn-bg text-warn",
  danger: "bg-danger-bg text-danger",
};

/** A small rounded status label, like "Not shown" or "Pre-registered". */
export function Pill({ tone = "neutral", dot = false, mono = false, children }: { tone?: Tone; dot?: boolean; mono?: boolean; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${TONES[tone]} ${mono ? "font-mono" : ""}`}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
