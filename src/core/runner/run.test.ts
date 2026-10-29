import { describe, expect, test } from "vitest";
import { loadPricing } from "../cost/pricing";
import type { Case } from "../domain/case";
import { CacheMissError } from "../llm/errors";
import { FakeLlm, http, ok } from "../llm/fake";
import type { LlmClient, LlmRequest, LlmResponse } from "../llm/port";
import { resolveVersion, saveVersion, type Stored } from "../prompts/version";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CostGateError } from "./budget";
import { runExperiment } from "./run";

const good = '{"category":"other","priority":"low","order_id":null}';

const mkCase = (n: number, split: Case["split"] = "tuning"): Case => ({
  case_id: `t-${String(n).padStart(3, "0")}`,
  split,
  slice: "clear",
  pair_id: null,
  text: `ticket text ${n}`,
  gold: { category: "other", priority: "low", order_id: null },
  injection: null,
  provenance: { drafted_by: "x", intended: { category: "other", priority: "low" }, human_label: null, adjudicated: false },
});

const tmp = mkdtempSync(path.join(tmpdir(), "pf-run-"));
const version = (name: string, examples: "none" | "fewshot", mode: "json_prompt" | "json_strict"): { name: string; version: Stored } => {
  saveVersion(tmp, {
    name,
    examples,
    output_mode: mode,
    created_at: "2026-10-30T10:00:00Z",
    messages: [
      { role: "system", content: "Classify. {{categories}}" },
      { role: "user", content: examples === "fewshot" ? "{{examples}}\n\nTicket:\n{{ticket}}" : "Ticket:\n{{ticket}}" },
    ],
  });
  return { name, version: resolveVersion(tmp, name) };
};

const cases = Array.from({ length: 10 }, (_, i) => mkCase(i + 1));
const zeroJson = version("zero-json", "none", "json_prompt");
const zeroStrict = version("zero-strict", "none", "json_strict");
const fewJson = version("few-json", "fewshot", "json_prompt");

describe("runExperiment", () => {
  test("gives one result per variant and case, in input order", async () => {
    const llm = new FakeLlm(() => ok(good));
    const results = await runExperiment({ variants: [zeroJson, zeroStrict], cases, pool: cases, llm });
    expect(results).toHaveLength(20);
    expect(results.map((r) => `${r.variant}/${r.case_id}`)).toEqual(
      ["zero-json", "zero-strict"].flatMap((v) => cases.map((c) => `${v}/${c.case_id}`)),
    );
    expect(results.every((r) => r.code === null && r.prediction?.category === "other")).toBe(true);
    expect(results[0].variant_id).toBe(zeroJson.version.id);
  });

  test("never has more than 4 calls in flight, and does reach 4", async () => {
    let inFlight = 0;
    let max = 0;
    const slow: LlmClient = {
      async complete(): Promise<LlmResponse> {
        max = Math.max(max, ++inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return ok(good);
      },
    };
    await runExperiment({ variants: [zeroJson, zeroStrict], cases, pool: cases, llm: slow });
    expect(max).toBe(4);
  });

  test("reports progress once per finished pair", async () => {
    const seen: [number, number][] = [];
    await runExperiment({
      variants: [zeroJson],
      cases,
      pool: cases,
      llm: new FakeLlm(() => ok(good)),
      progress: (done, total) => seen.push([done, total]),
    });
    expect(seen).toHaveLength(10);
    expect(seen.map(([d]) => d)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(seen.every(([, t]) => t === 10)).toBe(true);
  });

  test("each bad answer becomes its failure code and keeps the raw text", async () => {
    const answers = ["not json", '{"category":"Billing","priority":"low","order_id":null}', '{"priority":"low"}'];
    const llm = new FakeLlm((_r, n) => ok(answers[n]));
    const results = await runExperiment({ variants: [zeroJson], cases: cases.slice(0, 3), pool: cases, llm, concurrency: 1 });
    expect(results.map((r) => r.code)).toEqual(["invalid_json", "invalid_label", "schema_violation"]);
    expect(results.map((r) => r.raw?.content)).toEqual(answers);
    expect(results.every((r) => r.prediction === null)).toBe(true);
  });

  test("a provider error is an outcome with its status, and the rest still run", async () => {
    const llm = new FakeLlm((_r, n) => (n === 1 ? http(500) : ok(good)));
    const results = await runExperiment({ variants: [zeroJson], cases: cases.slice(0, 3), pool: cases, llm, concurrency: 1 });
    expect(results.map((r) => r.code)).toEqual([null, "provider_error", null]);
    expect(results[1]).toMatchObject({ detail: "500", raw: null, usage: null });
  });

  test("a cache miss stops the run: no new call starts, and the error is thrown", async () => {
    const calls: LlmRequest[] = [];
    const replay: LlmClient = {
      async complete(req) {
        calls.push(req);
        if (calls.length === 2) throw new CacheMissError("abcdef0123456789");
        return ok(good);
      },
    };
    await expect(runExperiment({ variants: [zeroJson], cases, pool: cases, llm: replay, concurrency: 1 })).rejects.toBeInstanceOf(CacheMissError);
    expect(calls).toHaveLength(2);
  });

  test("strict variants send a response_format and json variants do not", async () => {
    const llm = new FakeLlm(() => ok(good));
    await runExperiment({ variants: [zeroJson, zeroStrict], cases: cases.slice(0, 1), pool: cases, llm, concurrency: 1 });
    expect(llm.calls[0].response_format).toBeUndefined();
    expect(llm.calls[1].response_format).toMatchObject({ type: "json_schema" });
  });

  test("few-shot examples come only from the fewshot split", async () => {
    const pool = [...cases, mkCase(90, "fewshot"), mkCase(91, "holdout")];
    const llm = new FakeLlm(() => ok(good));
    await runExperiment({ variants: [fewJson], cases: cases.slice(0, 1), pool, llm });
    const prompt = llm.calls[0].messages[1].content;
    expect(prompt).toContain("ticket text 90");
    expect(prompt).not.toContain("ticket text 91");
    expect(prompt).not.toContain("Example 2");
  });
});


describe("cost gate", () => {
  const pricing = loadPricing("pricing.json");

  test("over the limit: throws CostGateError and makes 0 calls", async () => {
    const llm = new FakeLlm(() => ok(good));
    await expect(
      runExperiment({ variants: [zeroJson, zeroStrict], cases, pool: cases, llm, budget: { pricing, maxUsd: 0.0001 } }),
    ).rejects.toBeInstanceOf(CostGateError);
    expect(llm.calls).toHaveLength(0);
  });

  test("within the limit: runs", async () => {
    const llm = new FakeLlm(() => ok(good));
    await runExperiment({ variants: [zeroJson], cases, pool: cases, llm, budget: { pricing, maxUsd: 1 } });
    expect(llm.calls).toHaveLength(10);
  });

  test("cached requests cost nothing, so a limit of 0 still passes when all are cached", async () => {
    const llm = new FakeLlm(() => ok(good));
    const results = await runExperiment({
      variants: [zeroJson],
      cases,
      pool: cases,
      llm,
      budget: { pricing, maxUsd: 0, isCached: () => true },
    });
    expect(results).toHaveLength(10);
  });

  test("only the uncached half counts toward the limit", async () => {
    let n = 0;
    const everySecondCached = () => n++ % 2 === 0;
    const llm = new FakeLlm(() => ok(good));
    await expect(
      runExperiment({ variants: [zeroJson], cases, pool: cases, llm, budget: { pricing, maxUsd: 0, isCached: everySecondCached } }),
    ).rejects.toBeInstanceOf(CostGateError);
    expect(llm.calls).toHaveLength(0);
  });
});
