import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { DirtyTreeError, PreregistrationError, guardRun } from "@/core/artifacts/guard";
import { NotAGitRepoError } from "@/core/artifacts/git";
import { runId } from "@/core/artifacts/naming";
import { loadPricing } from "@/core/cost/pricing";
import { readJsonl, writeJsonl } from "@/core/dataset/jsonl";
import { seedIds } from "@/core/dataset/seed";
import { Case } from "@/core/domain/case";
import { CachingLlm } from "@/core/llm/cache";
import { CacheMissError } from "@/core/llm/errors";
import type { LlmClient } from "@/core/llm/port";
import { ResilientLlm } from "@/core/llm/resilient";
import { readFrozen } from "@/core/prompts/frozen";
import { resolveVersion } from "@/core/prompts/version";
import { CostGateError } from "@/core/runner/budget";
import { runExperiment } from "@/core/runner/run";
import { NoApiKeyError, type Deps } from "../deps";
import { EXIT } from "../exit";

export async function run(argv: string[], deps: Deps): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      split: { type: "string", default: "tuning" },
      variants: { type: "string" },
      limit: { type: "string" },
      "max-usd": { type: "string", default: "2" },
      replay: { type: "boolean" },
      "allow-dirty": { type: "boolean" },
      "seed-set": { type: "boolean" },
    },
  });
  const split = values.split as string;
  if (split !== "tuning" && split !== "holdout") {
    deps.err(`--split must be tuning or holdout (fewshot cases are never scored), got "${split}"`);
    return EXIT.USAGE;
  }
  const maxUsd = Number(values["max-usd"]);
  const limit = values.limit === undefined ? Infinity : Number(values.limit);
  if (!(maxUsd >= 0) || !(limit >= 0)) {
    deps.err("--max-usd and --limit must be non-negative numbers");
    return EXIT.USAGE;
  }

  // Variants: names or 8-character ids. Default is the frozen set.
  const refs = values.variants ? values.variants.split(",").map((s) => s.trim()) : Object.keys(readFrozen(deps.dataDir));
  if (refs.length === 0) {
    deps.err("no variants. Pass --variants or freeze some in prompts/frozen.json");
    return EXIT.USAGE;
  }
  let variants;
  try {
    variants = refs.map((ref) => {
      const version = resolveVersion(deps.dataDir, values.variants ? ref : readFrozen(deps.dataDir)[ref]);
      return { name: version.name, version };
    });
  } catch (e) {
    deps.err((e as Error).message);
    return EXIT.USAGE;
  }

  try {
    guardRun(split, deps.repoState(), values["allow-dirty"] ?? false);
  } catch (e) {
    if (e instanceof DirtyTreeError || e instanceof PreregistrationError || e instanceof NotAGitRepoError) {
      deps.err(e.message);
      return EXIT.DIRTY_TREE;
    }
    throw e;
  }

  const all = readJsonl(path.join(deps.dataDir, "fixtures", "tickets", "cases.jsonl"), Case);
  const seeds = values["seed-set"] ? seedIds(all) : null;
  const cases = all.filter((c) => c.split === split && (!seeds || seeds.has(c.case_id))).slice(0, limit);
  if (cases.length === 0) {
    deps.err(`no labeled ${split} cases${seeds ? " in the seed set" : ""}. Label them, then run: pnpm pf apply-review`);
    return EXIT.USAGE;
  }
  if (variants.some((v) => v.version.examples === "fewshot") && !all.some((c) => c.split === "fewshot")) {
    deps.err("few-shot variants need labeled fewshot cases. Label them, then run: pnpm pf apply-review");
    return EXIT.USAGE;
  }

  // Cache outside, retries inside: a cached answer never goes through retry logic.
  let inner: LlmClient | null = null;
  if (!values.replay) {
    try {
      inner = new ResilientLlm(deps.makeLlm());
    } catch (e) {
      if (!(e instanceof NoApiKeyError)) throw e;
      deps.out("no OPENAI_API_KEY: replay mode (answers come from the cache only)");
    }
  }
  const llm = new CachingLlm(inner, { dir: path.join(deps.dataDir, "cache", "responses"), now: deps.now });

  let results;
  try {
    results = await runExperiment({
      variants,
      cases,
      pool: all,
      llm,
      budget: inner ? { pricing: loadPricing(deps.pricingFile), maxUsd, isCached: (req) => llm.isCached(req) } : undefined,
      progress: (done, total) => {
        if (done === total || done % 25 === 0) deps.out(`  ${done}/${total}`);
      },
    });
  } catch (e) {
    if (e instanceof CostGateError) {
      deps.err(e.message);
      return EXIT.COST_GATE;
    }
    if (e instanceof CacheMissError) {
      deps.err(`${e.message}. Replay mode never calls the API. No run folder was written.`);
      return EXIT.CACHE_MISS;
    }
    throw e;
  }

  const id = uniqueRunId(path.join(deps.dataDir, "experiments"), runId(deps.now(), split));
  const dir = path.join(deps.dataDir, "experiments", id);
  mkdirSync(dir, { recursive: true });
  writeJsonl(path.join(dir, "per_case_results.jsonl"), results);

  deps.out(`run ${id}: ${cases.length} cases x ${variants.length} variants, cache hits ${llm.stats.hits}, misses ${llm.stats.misses}`);
  for (const v of variants) {
    const mine = results.filter((r) => r.variant === v.name);
    const counts = new Map<string, number>();
    mine.forEach((r) => counts.set(r.code ?? "ok", (counts.get(r.code ?? "ok") ?? 0) + 1));
    deps.out(`  ${v.name}: ${[...counts].map(([k, n]) => `${n} ${k}`).join(", ")}`);
  }
  return EXIT.OK;
}

/** Two runs in the same second must not share a folder. */
function uniqueRunId(experiments: string, base: string): string {
  let id = base;
  for (let n = 2; existsSync(path.join(experiments, id)); n++) id = `${base}-${n}`;
  return id;
}

