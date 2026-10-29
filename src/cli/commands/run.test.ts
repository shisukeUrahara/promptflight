import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { writeJsonl } from "@/core/dataset/jsonl";
import type { Case } from "@/core/domain/case";
import { CATEGORIES } from "@/core/domain/labels";
import { FakeLlm, ok } from "@/core/llm/fake";
import { writeFrozen } from "@/core/prompts/frozen";
import { saveVersion } from "@/core/prompts/version";
import { NoApiKeyError, type Deps } from "../deps";
import { EXIT } from "../exit";
import { main } from "../main";

const answer = '{"category":"other","priority":"low","order_id":null}';

const mkCase = (n: number, split: Case["split"], category = CATEGORIES[n % 9]): Case => ({
  case_id: `t-${String(n).padStart(3, "0")}`,
  split,
  slice: "clear",
  pair_id: null,
  text: `ticket ${n}`,
  gold: { category, priority: "low", order_id: null },
  injection: null,
  provenance: { drafted_by: "x", intended: { category, priority: "low" }, human_label: null, adjudicated: false },
});

let dataDir: string;
let llm: FakeLlm;
let out: string[];
let errs: string[];
let deps: Deps;
let now: Date;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "pf-runcmd-"));
  const cases = [
    ...[1, 2].map((n) => mkCase(n, "fewshot")),
    ...[11, 12, 13, 14, 15, 16].map((n) => mkCase(n, "tuning")),
    ...[21, 22, 23].map((n) => mkCase(n, "holdout")),
  ];
  writeJsonl(path.join(dataDir, "fixtures/tickets/cases.jsonl"), cases);

  const frozen: Record<string, string> = {};
  for (const [name, examples, mode] of [
    ["zero-json", "none", "json_prompt"],
    ["zero-strict", "none", "json_strict"],
    ["few-json", "fewshot", "json_prompt"],
    ["few-strict", "fewshot", "json_strict"],
  ] as const) {
    frozen[name] = saveVersion(dataDir, {
      name,
      examples,
      output_mode: mode,
      created_at: "2026-10-30T10:00:00Z",
      messages: [
        { role: "system", content: "Classify. {{categories}}" },
        { role: "user", content: examples === "fewshot" ? "{{examples}}\n\n{{ticket}}" : "{{ticket}}" },
      ],
    }).id;
  }
  writeFrozen(dataDir, frozen);

  llm = new FakeLlm(() => ok(answer));
  out = [];
  errs = [];
  now = new Date("2026-10-31T10:15:00Z");
  deps = {
    dataDir,
    pricingFile: "pricing.json",
    makeLlm: () => llm,
    now: () => now,
    out: (l) => out.push(l),
    err: (l) => errs.push(l),
  };
});

const runs = () => (existsSync(path.join(dataDir, "experiments")) ? readdirSync(path.join(dataDir, "experiments")) : []);
const rows = (id: string) =>
  readFileSync(path.join(dataDir, "experiments", id, "per_case_results.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));

describe("pf run", () => {
  test("writes N x V rows for the frozen variants", async () => {
    expect(await main(["run", "--split", "tuning"], deps)).toBe(EXIT.OK);
    expect(runs()).toEqual(["20261031T101500Z-tuning"]);
    const r = rows(runs()[0]);
    expect(r).toHaveLength(6 * 4);
    expect(new Set(r.map((x) => x.variant))).toEqual(new Set(["zero-json", "zero-strict", "few-json", "few-strict"]));
    expect(llm.calls).toHaveLength(24);
    expect(r.every((x) => x.cached === false && x.raw.content === answer)).toBe(true);
  });

  test("a second run is all cache hits and makes no call", async () => {
    await main(["run"], deps);
    now = new Date("2026-10-31T10:15:00Z"); // same second: needs its own folder
    await main(["run"], deps);
    expect(llm.calls).toHaveLength(24);
    expect(runs()).toHaveLength(2);
    expect(rows(runs()[1]).every((x) => x.cached === true)).toBe(true);
    expect(out.join("\n")).toContain("cache hits 24, misses 0");
  });

  test("--replay with an empty cache exits 2 and writes no run folder", async () => {
    expect(await main(["run", "--replay"], deps)).toBe(EXIT.CACHE_MISS);
    expect(runs()).toEqual([]);
    expect(llm.calls).toHaveLength(0);
    expect(errs.join()).toContain("No run folder was written");
  });

  test("replay after a live run reproduces it with no call", async () => {
    await main(["run"], deps);
    expect(await main(["run", "--replay"], deps)).toBe(EXIT.OK);
    expect(llm.calls).toHaveLength(24);
  });

  test("with no key it falls back to replay mode, and a miss still exits 2", async () => {
    deps.makeLlm = () => {
      throw new NoApiKeyError();
    };
    expect(await main(["run"], deps)).toBe(EXIT.CACHE_MISS);
    expect(out.join()).toContain("replay mode");
  });

  test("--max-usd below the estimate exits 4 with 0 calls", async () => {
    expect(await main(["run", "--max-usd", "0.00001"], deps)).toBe(EXIT.COST_GATE);
    expect(llm.calls).toHaveLength(0);
    expect(runs()).toEqual([]);
  });

  test("--variants takes names and ids; --limit trims cases", async () => {
    const id = JSON.parse(readFileSync(path.join(dataDir, "prompts/frozen.json"), "utf8"))["few-json"];
    expect(await main(["run", "--variants", `zero-json,${id}`, "--limit", "2"], deps)).toBe(EXIT.OK);
    const r = rows(runs()[0]);
    expect(r).toHaveLength(4);
    expect(new Set(r.map((x) => x.variant))).toEqual(new Set(["zero-json", "few-json"]));
  });

  test("--split holdout runs the holdout cases only", async () => {
    await main(["run", "--split", "holdout", "--variants", "zero-json"], deps);
    expect(rows(runs()[0]).map((r) => r.case_id)).toEqual(["t-021", "t-022", "t-023"]);
  });

  test("usage errors exit 64: bad split, fewshot split, unknown variant, no cases", async () => {
    expect(await main(["run", "--split", "fewshot"], deps)).toBe(EXIT.USAGE);
    expect(await main(["run", "--split", "x"], deps)).toBe(EXIT.USAGE);
    expect(await main(["run", "--variants", "nope"], deps)).toBe(EXIT.USAGE);
    expect(errs.join()).toContain('no prompt version matches "nope"');
    writeJsonl(path.join(dataDir, "fixtures/tickets/cases.jsonl"), []);
    expect(await main(["run"], deps)).toBe(EXIT.USAGE);
    expect(llm.calls).toHaveLength(0);
  });

  test("few-shot variants without fewshot cases are refused up front", async () => {
    writeJsonl(path.join(dataDir, "fixtures/tickets/cases.jsonl"), [mkCase(11, "tuning")]);
    expect(await main(["run"], deps)).toBe(EXIT.USAGE);
    expect(errs.join()).toContain("fewshot cases");
    expect(llm.calls).toHaveLength(0);
  });

  test("--seed-set keeps only the seed cases of the split", async () => {
    // 9 categories x (1 fewshot + 3 tuning): the seed keeps the fewshot and the first 2 tuning per category
    const cases = CATEGORIES.flatMap((category, i) => [
      mkCase(100 + i * 10 + 1, "fewshot", category),
      mkCase(100 + i * 10 + 2, "tuning", category),
      mkCase(100 + i * 10 + 3, "tuning", category),
      mkCase(100 + i * 10 + 4, "tuning", category),
    ]);
    writeJsonl(path.join(dataDir, "fixtures/tickets/cases.jsonl"), cases);
    await main(["run", "--seed-set", "--variants", "zero-json"], deps);
    expect(rows(runs()[0])).toHaveLength(18);
  });
});
