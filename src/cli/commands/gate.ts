import path from "node:path";
import { parseArgs } from "node:util";
import { readJsonl } from "@/core/dataset/jsonl";
import { Case } from "@/core/domain/case";
import { CachingLlm } from "@/core/llm/cache";
import { CacheMissError } from "@/core/llm/errors";
import { mcnemarExact, pairedCounts } from "@/core/metrics/paired";
import { resolveVersion } from "@/core/prompts/version";
import { runExperiment } from "@/core/runner/run";
import type { Deps } from "../deps";
import { EXIT } from "../exit";

/**
 * Fails when the candidate prompt is significantly worse than the baseline on the same tickets.
 * Always replays from the cache, so it needs no key and costs nothing: run the candidate with
 * `pf run` first. A name means the newest version; an 8-character id means that exact version.
 */
export async function gate(argv: string[], deps: Deps): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: { baseline: { type: "string" }, candidate: { type: "string" }, split: { type: "string", default: "tuning" }, alpha: { type: "string", default: "0.05" }, model: { type: "string" } },
  });
  const alpha = Number(values.alpha);
  if (!values.baseline || !values.candidate || (values.split !== "tuning" && values.split !== "holdout") || !(alpha > 0 && alpha < 1)) {
    deps.err("usage: pf gate --baseline <name|id> --candidate <name|id> [--split tuning|holdout] [--alpha 0.05]");
    return EXIT.USAGE;
  }

  let base, cand;
  try {
    base = resolveVersion(deps.dataDir, values.baseline);
    cand = resolveVersion(deps.dataDir, values.candidate);
  } catch (e) {
    deps.err((e as Error).message);
    return EXIT.USAGE;
  }
  const all = readJsonl(path.join(deps.dataDir, "fixtures", "tickets", "cases.jsonl"), Case);
  const cases = all.filter((c) => c.split === values.split);
  if (cases.length === 0) {
    deps.err(`no labeled ${values.split} cases`);
    return EXIT.USAGE;
  }

  let results;
  try {
    results = await runExperiment({
      // Labels, not names: the two sides may be versions of the same prompt.
      variants: [
        { name: "baseline", version: base },
        { name: "candidate", version: cand },
      ],
      cases,
      pool: all,
      model: values.model ?? deps.model,
      llm: new CachingLlm(null, { dir: path.join(deps.dataDir, "cache", "responses") }),
    });
  } catch (e) {
    if (e instanceof CacheMissError) {
      deps.err(`${e.message}. The gate only replays. Run both versions with pf run first.`);
      return EXIT.CACHE_MISS;
    }
    throw e;
  }

  const gold = new Map(cases.map((c) => [c.case_id, c.gold.category]));
  const correct = (variant: string) => results.filter((r) => r.variant === variant).map((r) => r.prediction?.category === gold.get(r.case_id));
  const counts = pairedCounts(correct("baseline"), correct("candidate"));
  const p = mcnemarExact(counts);
  const worse = counts.b_only < counts.a_only && p < alpha;

  deps.out(`baseline ${base.name} ${base.id} vs candidate ${cand.name} ${cand.id} on ${cases.length} ${values.split} tickets`);
  deps.out(`both right ${counts.both_right}, both wrong ${counts.both_wrong}, only baseline right ${counts.a_only}, only candidate right ${counts.b_only}`);
  deps.out(`exact McNemar p = ${p.toFixed(4)}, alpha = ${alpha}: ${worse ? "FAIL, candidate is significantly worse" : "ok"}`);
  return worse ? EXIT.GATE_FAILED : EXIT.OK;
}
