import { parseArgs } from "node:util";
import { DEFAULT_SETUP, minDetectableEffect } from "@/core/metrics/power";
import type { Deps } from "../deps";
import { EXIT } from "../exit";

export async function power(argv: string[], deps: Deps): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      n: { type: "string", default: "90" },
      discordant: { type: "string", default: String(DEFAULT_SETUP.discordant) },
      alpha: { type: "string", default: String(DEFAULT_SETUP.alpha) },
      power: { type: "string", default: "0.8" },
      sims: { type: "string", default: String(DEFAULT_SETUP.sims) },
      seed: { type: "string", default: String(DEFAULT_SETUP.seed) },
    },
  });
  const n = Number(values.n);
  const discordant = Number(values.discordant);
  const alpha = Number(values.alpha);
  const target = Number(values.power);
  const sims = Number(values.sims);
  const seed = Number(values.seed);
  const bad = !(Number.isInteger(n) && n > 0) || !(discordant > 0 && discordant <= 1) || !(alpha > 0 && alpha < 1) || !(target > 0 && target < 1) || !(Number.isInteger(sims) && sims > 0) || !Number.isInteger(seed);
  if (bad) {
    deps.err("usage: pf power [--n 90] [--discordant 0.2] [--alpha 0.0125] [--power 0.8] [--sims 2000] [--seed 1]");
    return EXIT.USAGE;
  }
  const { mde, powerAtMde } = minDetectableEffect({ n, discordant, alpha, sims, seed }, target);
  const setup = `N=${n}, ${(discordant * 100).toFixed(0)}% of tickets differ between variants, alpha=${alpha}, power=${target}`;
  deps.out(
    mde === null
      ? `${setup}: no accuracy difference up to ${discordant} is detectable`
      : `${setup}: smallest detectable accuracy difference = ${mde.toFixed(2)} (simulated power ${powerAtMde!.toFixed(2)}, ${sims} runs, seed ${seed})`,
  );
  return EXIT.OK;
}
