/** Shown while a page reads its run files. Shapes only; no made-up numbers. */
export default function Loading() {
  const block = "rounded-3xl border border-line bg-surface/70 motion-safe:animate-pulse";
  return (
    <div role="status" aria-label="Loading" className="space-y-8">
      <div className="h-14 w-64 rounded-2xl bg-surface-2 motion-safe:animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-48 ${block}`} />
        ))}
      </div>
      <div className={`h-64 ${block}`} />
    </div>
  );
}
