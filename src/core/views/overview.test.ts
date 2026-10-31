import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { RunScores } from "../artifacts/scores";
import { readJsonl } from "../dataset/jsonl";
import { Case } from "../domain/case";
import { CaseResult } from "../runner/types";
import { overviewStats } from "./overview";

// The synthetic UI fixture: its numbers are fake, but the arithmetic must hold on them.
const root = "e2e/fixtures/data";
const run = readdirSync(`${root}/experiments`).find((d) => d.endsWith("-holdout"))!;
const scores: RunScores = JSON.parse(readFileSync(`${root}/experiments/${run}/scores.json`, "utf8"));
const results = readJsonl(`${root}/experiments/${run}/per_case_results.jsonl`, CaseResult);
const cases = readJsonl(`${root}/fixtures/tickets/cases.jsonl`, Case);
const o = overviewStats(scores, results, cases);

describe("overviewStats on the fixture run", () => {
  test("one prompt per variant, exactly one marked highest, and it has the top accuracy", () => {
    expect(o.prompts.map((p) => p.name)).toEqual(scores.variants.map((v) => v.variant));
    const highest = o.prompts.filter((p) => p.highest);
    expect(highest).toHaveLength(1);
    expect(highest[0].accuracy).toBe(Math.max(...scores.variants.map((v) => v.accuracy)));
  });
  test("the largest primary gap is the category contrast with the biggest |difference|", () => {
    const cat = scores.contrasts.filter((c) => c.metric === "category");
    const max = Math.max(...cat.map((c) => Math.abs(c.accuracy_diff.point)));
    expect(Math.abs(o.verdict.largest!.accuracy_diff.point)).toBe(max);
    expect(o.verdict.largest!.metric).toBe("category");
  });
  test("ranges and totals match the variants", () => {
    expect(o.injection.min).toBe(Math.min(...scores.variants.map((v) => v.injection.followed)));
    expect(o.promptTokens.max).toBe(Math.max(...scores.variants.map((v) => v.tokens.prompt_mean)));
    expect(o.runCostUsd).toBeCloseTo(scores.variants.reduce((s, v) => s + (v.cost_per_100_usd * v.n_total) / 100, 0), 12);
  });
  test("per-type accuracy is present for every prompt", () => {
    for (const p of o.prompts) expect(Object.keys(p.bySlice).sort()).toEqual(["ambiguous_pair", "clear", "injection", "noisy"]);
  });
  test("always-wrong tickets are counted with their most common gold label", () => {
    expect(o.alwaysWrong.count).toBeGreaterThanOrEqual(0);
    if (o.alwaysWrong.count > 0) expect(o.alwaysWrong.topGold!.count).toBeLessThanOrEqual(o.alwaysWrong.count);
  });
});

describe("the verdict", () => {
  test("says not shown when no primary Holm p is below 0.05", () => {
    const quiet = { ...scores, contrasts: scores.contrasts.map((c) => ({ ...c, p_holm: 0.5 })) };
    expect(overviewStats(quiet, results, cases).verdict.anyShown).toBe(false);
  });
  test("flips to shown when one primary Holm p is below 0.05", () => {
    const loud = { ...scores, contrasts: scores.contrasts.map((c, i) => ({ ...c, p_holm: i === 0 ? 0.01 : 0.5 })) };
    expect(overviewStats(loud, results, cases).verdict.anyShown).toBe(true);
  });
  test("a significant priority contrast does not count as a primary result", () => {
    const pri = { ...scores, contrasts: scores.contrasts.map((c) => ({ ...c, p_holm: c.metric === "priority" ? 0.01 : 0.5 })) };
    expect(overviewStats(pri, results, cases).verdict.anyShown).toBe(false);
  });
});
