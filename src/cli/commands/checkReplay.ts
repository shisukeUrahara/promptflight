import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { listRuns, loadRun } from "@/core/artifacts/runs";
import { buildScores } from "@/core/artifacts/scores";
import { loadPricing } from "@/core/cost/pricing";
import { readJsonl } from "@/core/dataset/jsonl";
import { Case } from "@/core/domain/case";
import { CachingLlm } from "@/core/llm/cache";
import { CacheMissError } from "@/core/llm/errors";
import { resolveVersion } from "@/core/prompts/version";
import { runExperiment } from "@/core/runner/run";
import type { CaseResult } from "@/core/runner/types";
import type { Deps } from "../deps";
import { EXIT } from "../exit";

/** `cached` says how an answer was obtained this time, not what the answer was, so it is left out. */
const answer = (r: CaseResult) => JSON.stringify({ ...r, cached: undefined });

/**
 * Re-runs committed experiments from the response cache, with no API key, and checks that every
 * answer comes back the same and the scores rebuild the same. Exit 1 on any difference, 2 on a cache miss.
 * A scores.json written by older scoring code is reported, not failed: the answers are the evidence.
 */
export async function checkReplay(argv: string[], deps: Deps): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { run: { type: "string" } } });
  const ids = values.run ? [values.run] : listRuns(deps.dataDir).map((r) => r.id).reverse();
  if (ids.length === 0) {
    deps.out("no runs to check");
    return EXIT.OK;
  }
  const all = readJsonl(path.join(deps.dataDir, "fixtures", "tickets", "cases.jsonl"), Case);
  const pricing = loadPricing(deps.pricingFile);
  const llm = new CachingLlm(null, { dir: path.join(deps.dataDir, "cache", "responses") });
  let failed = false;

  for (const id of ids) {
    let run;
    try {
      run = loadRun(deps.dataDir, id);
    } catch (e) {
      deps.err((e as Error).message);
      return EXIT.USAGE;
    }
    const { manifest, results } = run;
    const caseIds = [...new Set(results.map((r) => r.case_id))];
    const byId = new Map(all.map((c) => [c.case_id, c]));
    const missing = caseIds.filter((c) => !byId.has(c));
    if (missing.length > 0) {
      deps.err(`${id}: cases no longer in the dataset: ${missing.join(", ")}`);
      failed = true;
      continue;
    }

    let replayed: CaseResult[];
    try {
      replayed = await runExperiment({
        variants: Object.entries(manifest.variants).map(([name, vid]) => ({ name, version: resolveVersion(deps.dataDir, vid) })),
        cases: caseIds.map((c) => byId.get(c)!),
        pool: all,
        llm,
        model: manifest.model,
      });
    } catch (e) {
      if (e instanceof CacheMissError) {
        deps.err(`${id}: ${e.message}`);
        return EXIT.CACHE_MISS;
      }
      throw e;
    }

    const diff = replayed.findIndex((r, i) => answer(r) !== answer(results[i]));
    if (diff !== -1 || replayed.length !== results.length) {
      const r = replayed[diff] ?? results[diff];
      deps.err(`${id}: answer differs at ${r?.variant} ${r?.case_id}`);
      failed = true;
      continue;
    }
    const opts = { cases: all, pricing, model: manifest.model, split: manifest.split };
    const fromReplay = JSON.stringify(buildScores({ ...opts, results: replayed }), null, 2) + "\n";
    if (fromReplay !== JSON.stringify(buildScores({ ...opts, results }), null, 2) + "\n") {
      deps.err(`${id}: scores rebuilt from the replay differ`);
      failed = true;
      continue;
    }
    const committed = readFileSync(path.join(deps.dataDir, "experiments", id, "scores.json"), "utf8");
    const note = committed === fromReplay ? "scores.json identical" : "answers identical; scores.json was written by older scoring code";
    deps.out(`${id}: ${results.length} answers replayed, ${note}`);
  }
  return failed ? EXIT.GATE_FAILED : EXIT.OK;
}
