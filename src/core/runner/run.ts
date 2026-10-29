import pLimit from "p-limit";
import type { Case } from "../domain/case";
import { CacheMissError, ProviderError } from "../llm/errors";
import type { LlmClient } from "../llm/port";
import { buildRequest } from "../llm/strict";
import { renderMessages } from "../prompts/render";
import type { Stored } from "../prompts/version";
import { validateResponse } from "../validate/validate";
import type { CaseResult } from "./types";

export const CONCURRENCY = 4;

export interface RunOptions {
  /** The variants to compare, with the exact version of each. */
  variants: { name: string; version: Stored }[];
  /** The cases to score. */
  cases: readonly Case[];
  /** Every case known, so few-shot prompts can pick their examples from the fewshot split. */
  pool: readonly Case[];
  llm: LlmClient;
  concurrency?: number;
  progress?: (done: number, total: number, last: CaseResult) => void;
}

/**
 * Run every variant on every case and return one result per pair, in input order
 * (variants first, then cases), whatever order the calls finish in.
 * A CacheMissError (replay mode) stops the run: no new call starts, then the error is thrown.
 */
export async function runExperiment(opts: RunOptions): Promise<CaseResult[]> {
  const units = opts.variants.flatMap((variant) => opts.cases.map((c) => ({ variant, c })));
  const results = new Array<CaseResult>(units.length);
  const limit = pLimit(opts.concurrency ?? CONCURRENCY);
  let done = 0;
  let stop: CacheMissError | null = null;

  await Promise.all(
    units.map((unit, i) =>
      limit(async () => {
        if (stop) return;
        try {
          results[i] = await runOne(opts, unit.variant, unit.c);
        } catch (e) {
          if (e instanceof CacheMissError) return void (stop ??= e);
          throw e;
        }
        opts.progress?.(++done, units.length, results[i]);
      }),
    ),
  );
  if (stop) throw stop;
  return results;
}

async function runOne(opts: RunOptions, variant: RunOptions["variants"][number], c: Case): Promise<CaseResult> {
  const { version } = variant;
  const messages = renderMessages(version, { ticket: c.text, cases: opts.pool });
  const base = { case_id: c.case_id, variant: variant.name, variant_id: version.id };

  let res;
  try {
    res = await opts.llm.complete(buildRequest(version.output_mode, messages));
  } catch (e) {
    if (!(e instanceof ProviderError)) throw e;
    return { ...base, code: "provider_error", detail: String(e.status), prediction: null, raw: null, usage: null, latency_ms: null, cached: false };
  }

  const verdict = validateResponse(res);
  return {
    ...base,
    code: verdict.ok ? null : verdict.code,
    detail: verdict.ok ? null : verdict.detail,
    prediction: verdict.ok ? verdict.prediction : null,
    raw: { content: res.content, refusal: res.refusal, finish_reason: res.finish_reason },
    usage: res.usage,
    latency_ms: res.latency_ms,
    cached: res.cached,
  };
}
