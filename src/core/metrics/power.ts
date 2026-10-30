import { mulberry32 } from "../dataset/rng";
import { mcnemarExact } from "./paired";

export interface PowerSetup {
  /** Paired tickets. */
  n: number;
  /** Share of tickets where the two variants disagree. An assumption: it cannot be known before the run. */
  discordant: number;
  /** Significance level of one test. The default is the first Holm step, 0.05 / 4. */
  alpha: number;
  sims: number;
  seed: number;
}

export const DEFAULT_SETUP = { discordant: 0.2, alpha: 0.05 / 4, sims: 2000, seed: 1 } as const;

/**
 * Chance that McNemar rejects "no difference" when B really is `delta` more accurate than A.
 * Each simulated run: every ticket is discordant with probability `discordant`; B wins a
 * discordant ticket with probability 1/2 + delta / (2 * discordant), which makes the expected
 * accuracy gap exactly delta. The same random stream is reused for every delta (common
 * random numbers), so power never goes down as delta goes up by simulation noise alone.
 */
export function simulatePower(delta: number, setup: PowerSetup): number {
  const { n, discordant, alpha, sims, seed } = setup;
  if (delta > discordant) throw new Error("delta cannot exceed the discordant rate");
  const pB = discordant === 0 ? 0.5 : 0.5 + delta / (2 * discordant);
  const rng = mulberry32(seed);
  let rejected = 0;
  for (let s = 0; s < sims; s++) {
    let a = 0;
    let b = 0;
    for (let i = 0; i < n; i++) {
      if (rng() < discordant) {
        // One uniform per ticket, reused for the winner, so the stream length does not depend on delta.
        if (rng() < pB) b++;
        else a++;
      }
    }
    if (mcnemarExact({ a_only: a, b_only: b }) <= alpha) rejected++;
  }
  return rejected / sims;
}

export interface Mde {
  /** Smallest accuracy difference, in steps of 0.01, that reaches the target power. null if none up to the discordant rate. */
  mde: number | null;
  powerAtMde: number | null;
}

export function minDetectableEffect(setup: PowerSetup, targetPower = 0.8, step = 0.01): Mde {
  for (let delta = step; delta <= setup.discordant + 1e-9; delta += step) {
    const d = Math.round(delta * 1e6) / 1e6;
    const power = simulatePower(Math.min(d, setup.discordant), setup);
    if (power >= targetPower) return { mde: d, powerAtMde: power };
  }
  return { mde: null, powerAtMde: null };
}
