/** Color classes per variant. Text uses the -ink tone, which meets WCAG AA in both themes. */
export const VARIANT_META: Record<string, { dot: string; ink: string; bar: string; text: string; border: string }> = {
  "zero-json": { dot: "bg-v-zero-json", ink: "text-v-zero-json-ink", bar: "bg-v-zero-json", text: "text-v-zero-json", border: "border-v-zero-json" },
  "zero-strict": { dot: "bg-v-zero-strict", ink: "text-v-zero-strict-ink", bar: "bg-v-zero-strict", text: "text-v-zero-strict", border: "border-v-zero-strict" },
  "few-json": { dot: "bg-v-few-json", ink: "text-v-few-json-ink", bar: "bg-v-few-json", text: "text-v-few-json", border: "border-v-few-json" },
  "few-strict": { dot: "bg-v-few-strict", ink: "text-v-few-strict-ink", bar: "bg-v-few-strict", text: "text-v-few-strict", border: "border-v-few-strict" },
};
const FALLBACK = { dot: "bg-muted", ink: "text-ink", bar: "bg-muted", text: "text-muted", border: "border-line" };
export const variantMeta = (name: string) => VARIANT_META[name] ?? FALLBACK;

export function VariantName({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono ${className}`}>
      <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${variantMeta(name).dot}`} />
      <span className={variantMeta(name).ink}>{name}</span>
    </span>
  );
}
