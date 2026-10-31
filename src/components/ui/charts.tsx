/** Small hand-made charts. Each one is an image with a text label that says what it shows. */

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const clamp = (v: number) => Math.max(0, Math.min(1, v));

/** A ring that fills to `value` (0..1), with the value in the middle. `colorClass` sets the ring colour via text-*. */
export function DonutRing({ value, label, colorClass, size = 64 }: { value: number; label: string; colorClass: string; size?: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg role="img" aria-label={`${label}: ${pct(value)}`} viewBox="0 0 64 64" width={size} height={size} className={colorClass}>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="5" className="stroke-surface-2" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={`${clamp(value) * c} ${c}`}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" textAnchor="middle" className="fill-ink font-mono text-[11px]">
        {(value * 100).toFixed(1)}
      </text>
    </svg>
  );
}

/** A thin track with the 95% interval as a band and the point as a tick. All values 0..1. */
export function RangeBar({ lo, hi, point, label, barClass }: { lo: number; hi: number; point: number; label: string; barClass: string }) {
  return (
    <span role="img" aria-label={`${label}: ${pct(point)}, 95% interval ${pct(lo)} to ${pct(hi)}`} className="relative block h-1.5 w-full rounded-full bg-surface-2">
      <span className={`absolute inset-y-0 rounded-full opacity-60 ${barClass}`} style={{ left: `${clamp(lo) * 100}%`, width: `${(clamp(hi) - clamp(lo)) * 100}%` }} />
      <span className="absolute -top-1 h-3.5 w-0.5 rounded bg-ink" style={{ left: `calc(${clamp(point) * 100}% - 1px)` }} />
    </span>
  );
}

/** A plain horizontal bar, 0..1. */
export function HealthBar({ value, label, barClass }: { value: number; label: string; barClass: string }) {
  return (
    <span role="img" aria-label={`${label}: ${pct(value)}`} className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
      <span className={`block h-full rounded-full ${barClass}`} style={{ width: `${clamp(value) * 100}%` }} />
    </span>
  );
}

/** Two counts side by side in one bar, e.g. "only A right" vs "only B right". */
export function SplitBar({ a, b, aLabel, bLabel, aClass, bClass }: { a: number; b: number; aLabel: string; bLabel: string; aClass: string; bClass: string }) {
  const total = a + b;
  const share = total === 0 ? 0.5 : a / total;
  return (
    <div>
      <span role="img" aria-label={`${aLabel}: ${a}; ${bLabel}: ${b}`} className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2">
        {a > 0 && <span className={`h-full rounded-full ${aClass}`} style={{ width: `${share * 100}%` }} />}
        {b > 0 && <span className={`h-full rounded-full ${bClass}`} style={{ width: `${(1 - share) * 100}%` }} />}
      </span>
      <span className="mt-1.5 flex justify-between font-mono text-xs text-muted">
        <span>
          {aLabel} {a}
        </span>
        <span>
          {bLabel} {b}
        </span>
      </span>
    </div>
  );
}

/** A few vertical bars with labels under them, e.g. accuracy per ticket type. Values 0..max. */
export function MiniBars({ values, max, label, barClass, format = (v) => String(v) }: { values: { label: string; value: number }[]; max: number; label: string; barClass: string; format?: (v: number) => string }) {
  return (
    <figure role="img" aria-label={`${label}: ${values.map((v) => `${v.label} ${format(v.value)}`).join(", ")}`} className="m-0">
      <div className="flex h-16 items-end gap-1.5">
        {values.map((v) => (
          <span key={v.label} className="flex h-full flex-1 flex-col justify-end">
            <span className={`block w-full rounded-t-md ${barClass}`} style={{ height: `${max === 0 ? 0 : Math.max(4, (v.value / max) * 100)}%` }} />
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {values.map((v) => (
          <span key={v.label} className="flex-1 truncate text-center font-mono text-[10px] uppercase tracking-wide text-muted">
            {v.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
