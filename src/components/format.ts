export const fmt = (v: number | null | undefined, digits = 3) => (v === null || v === undefined ? "—" : v.toFixed(digits));
export const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
export const ci = (c?: { lo: number; hi: number }, digits = 3) => (c ? `[${c.lo.toFixed(digits)}, ${c.hi.toFixed(digits)}]` : "");
export const signed = (v: number, digits = 3) => `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
export const usd = (v: number) => `$${v.toFixed(v < 0.1 ? 4 : 2)}`;
export const ms = (v: number) => `${v.toLocaleString("en-US")} ms`;
