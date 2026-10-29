/** Share of items where both raters gave the same label. */
export function agreement(a: readonly string[], b: readonly string[]): number {
  check(a, b);
  return a.filter((x, i) => x === b[i]).length / a.length;
}

/**
 * Cohen's kappa: agreement beyond what two raters would reach by chance,
 * given how often each one uses each label. 1 is perfect, 0 is chance.
 * When both raters always use the same single label, chance agreement is
 * 1 and kappa is undefined; this returns 1.
 */
export function cohenKappa(a: readonly string[], b: readonly string[]): number {
  check(a, b);
  const n = a.length;
  const po = agreement(a, b);
  const count = (xs: readonly string[]) => xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>());
  const ca = count(a);
  const cb = count(b);
  let pe = 0;
  for (const [label, na] of ca) pe += (na / n) * ((cb.get(label) ?? 0) / n);
  return pe === 1 ? 1 : (po - pe) / (1 - pe);
}

function check(a: readonly string[], b: readonly string[]): void {
  if (a.length !== b.length) throw new Error(`rater lists differ in length: ${a.length} vs ${b.length}`);
  if (a.length === 0) throw new Error("no items to compare");
}
