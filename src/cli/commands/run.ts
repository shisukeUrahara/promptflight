import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { DirtyTreeError, PreregistrationError, guardRun } from "@/core/artifacts/guard";
import { NotAGitRepoError } from "@/core/artifacts/git";
import { RunManifest } from "@/core/artifacts/manifest";
import { runId, runLabel } from "@/core/artifacts/naming";
import { writeRunFolder } from "@/core/artifacts/runFolder";
import { buildScores, formatSummary } from "@/core/artifacts/scores";
import { loadPricing } from "@/core/cost/pricing";
import { INFRA_FAILURES } from "@/core/domain/outcome";
import { MAX_COMPLETION_TOKENS, MODEL_UNDER_TEST, TEMPERATURE } from "@/core/llm/strict";
import { readJsonl } from "@/core/dataset/jsonl";
import { sha256 } from "@/core/dataset/manifest";
import { seedIds } from "@/core/dataset/seed";
import { Case } from "@/core/domain/case";
import { CachingLlm } from "@/core/llm/cache";
import { CacheMissError } from "@/core/llm/errors";
import type { LlmClient, LlmRequest } from "@/core/llm/port";
import type { CaseResult } from "@/core/runner/types";
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
      model: { type: "string" },
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

  let repo;
  try {
    repo = deps.repoState();
    guardRun(split, repo, values["allow-dirty"] ?? false);
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
      inner = new ResilientLlm(deps.makeLlm(), { backoffMs: deps.retryBackoffMs });
    } catch (e) {
      if (!(e instanceof NoApiKeyError)) throw e;
      deps.out("no OPENAI_API_KEY: replay mode (answers come from the cache only)");
    }
  }
  const llm = new CachingLlm(inner, { dir: path.join(deps.dataDir, "cache", "responses"), now: deps.now });

  const model = values.model ?? deps.model ?? MODEL_UNDER_TEST;
  const pricing = loadPricing(deps.pricingFile);
  if (!pricing.models[model]) {
    deps.err(`no price for model "${model}" in pricing.json. Add it (with its source and date) before running.`);
    return EXIT.USAGE;
  }
  const runOpts = {
    model,
    variants,
    cases,
    pool: all,
    llm,
    budget: inner ? { pricing, maxUsd, isCached: (req: LlmRequest) => llm.isCached(req) } : undefined,
    progress: (done: number, total: number) => {
      if (done === total || done % 25 === 0) deps.out(`  ${done}/${total}`);
    },
  };
  const isInfra = (r: CaseResult) => r.code !== null && (INFRA_FAILURES as readonly string[]).includes(r.code);

  let results: CaseResult[];
  try {
    results = await runExperiment(runOpts);
    // Answers that worked are cached, so a second pass only repeats the calls that failed.
    if (split === "holdout" && results.some(isInfra)) results = await runExperiment(runOpts);
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

  const failed = results.filter(isInfra);
  if (failed.length === results.length) {
    // Nothing was scored: a bad key, a retired model, an outage. A run folder would only mislead.
    deps.err(`every call failed (first: ${failed[0].variant} ${failed[0].case_id}: ${failed[0].code} ${failed[0].detail ?? ""}). No run folder was written.`);
    return EXIT.INFRA_FAILURES;
  }
  if (split === "holdout" && failed.length > 0) {
    deps.err(`${failed.length} calls still failed after one more try. A holdout run must have none, so no scores were written:`);
    failed.slice(0, 10).forEach((r) => deps.err(`  ${r.variant} ${r.case_id}: ${r.code} ${r.detail ?? ""}`));
    return EXIT.INFRA_FAILURES;
  }

  const created = deps.now();
  const id = uniqueRunId(path.join(deps.dataDir, "experiments"), runId(created, split));
  const casesFile = path.join(deps.dataDir, "fixtures", "tickets", "cases.jsonl");
  const scores = buildScores({ results, cases: all, pricing, model, split });
  const manifest = RunManifest.parse({
    run_id: id,
    label: runLabel({ split, variantCount: variants.length, createdAt: created, model }),
    created_at_utc: created.toISOString(),
    split,
    sample_count: cases.length,
    model,
    variants: Object.fromEntries(variants.map((v) => [v.name, v.version.id])),
    temperature: TEMPERATURE,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    dataset_sha256: sha256(readFileSync(casesFile)),
    pricing_retrieved_at: pricing.retrieved_at,
    preregistration_sha: repo.preregistration_sha,
    git_sha: repo.git_sha,
    git_dirty: repo.git_dirty,
    allow_dirty: values["allow-dirty"] ?? false,
    replay: inner === null,
    cache_hits: llm.stats.hits,
    cache_misses: llm.stats.misses,
    infra_failures: failed.length,
  });
  writeRunFolder(path.join(deps.dataDir, "experiments", id), { manifest, results, scores });

  deps.out(`run ${id}: ${cases.length} cases x ${variants.length} variants, cache hits ${llm.stats.hits}, misses ${llm.stats.misses}, infrastructure failures ${failed.length}`);
  formatSummary(scores).forEach((line) => deps.out(line));
  return EXIT.OK;
}

/** Two runs in the same second must not share a folder. */
function uniqueRunId(experiments: string, base: string): string {
  let id = base;
  for (let n = 2; existsSync(path.join(experiments, id)); n++) id = `${base}-${n}`;
  return id;
}

