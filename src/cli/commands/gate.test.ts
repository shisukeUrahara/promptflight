import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { writeJsonl } from "@/core/dataset/jsonl";
import type { Case } from "@/core/domain/case";
import { FakeLlm, ok } from "@/core/llm/fake";
import { saveVersion } from "@/core/prompts/version";
import type { Deps } from "../deps";
import { EXIT } from "../exit";
import { main } from "../main";

const RIGHT = '{"category":"other","priority":"low","order_id":null}';
const WRONG = '{"category":"billing_refund","priority":"low","order_id":null}';

const mkCase = (n: number, split: Case["split"]): Case => ({
  case_id: `t-${String(n).padStart(3, "0")}`,
  split,
  slice: "clear",
  pair_id: null,
  text: `ticket ${n}`,
  gold: { category: "other", priority: "low", order_id: null },
  injection: null,
  provenance: { drafted_by: "x", intended: { category: "other", priority: "low" }, human_label: null, adjudicated: false },
});

let dataDir: string;
let out: string[];
let errs: string[];
let deps: Deps;
let llm: FakeLlm;
/** How each prompt answers a given ticket number. */
let behaviour: Record<string, (n: number) => boolean>;

const save = (name: string, tag: string) =>
  saveVersion(dataDir, {
    name,
    examples: "none",
    output_mode: "json_prompt",
    created_at: "2026-10-30T10:00:00Z",
    messages: [
      { role: "system", content: `Classify. ${tag}` },
      { role: "user", content: "{{ticket}}" },
    ],
  }).id;

beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "pf-gate-"));
  writeJsonl(path.join(dataDir, "fixtures/tickets/cases.jsonl"), [
    ...Array.from({ length: 10 }, (_, i) => mkCase(i + 1, "tuning")),
    mkCase(50, "holdout"),
  ]);
  save("base", "BASE");
  save("cand", "CAND");
  behaviour = { BASE: () => true, CAND: () => true };
  llm = new FakeLlm((req) => {
    const tag = (req.messages[0].content.match(/Classify\. (\w+)/) ?? [])[1];
    const n = Number(req.messages[1].content.replace("ticket ", ""));
    return ok(behaviour[tag](n) ? RIGHT : WRONG);
  });
  out = [];
  errs = [];
  deps = {
    dataDir,
    pricingFile: "pricing.json",
    makeLlm: () => llm,
    now: () => new Date("2026-10-31T10:15:00Z"),
    repoState: () => ({ git_sha: "a".repeat(40), git_dirty: false, preregistration_sha: "b".repeat(40) }),
    retryBackoffMs: [0, 0],
    out: (l) => out.push(l),
    err: (l) => errs.push(l),
  };
});

/** Fill the cache the way a person would: run both versions first. */
const prime = () => main(["run", "--variants", "base,cand"], deps);
const gate = (...extra: string[]) => main(["gate", "--baseline", "base", "--candidate", "cand", ...extra], deps);

describe("pf gate", () => {
  test("a synthetic regression exits 1: candidate loses 8 tickets the baseline wins", async () => {
    behaviour.CAND = (n) => n > 8;
    await prime();
    const calls = llm.calls.length;
    expect(await gate()).toBe(EXIT.GATE_FAILED);
    expect(out.join("\n")).toContain("only baseline right 8, only candidate right 0");
    expect(out.join("\n")).toContain("FAIL");
    expect(llm.calls).toHaveLength(calls); // replay only: no new call
  });

  test("identical prompts exit 0 with p = 1", async () => {
    await prime();
    expect(await gate()).toBe(EXIT.OK);
    expect(out.join("\n")).toContain("p = 1.0000");
  });

  test("a candidate that is better does not fail the gate", async () => {
    behaviour.BASE = (n) => n > 8;
    await prime();
    expect(await gate()).toBe(EXIT.OK);
  });

  test("a small, non-significant drop passes", async () => {
    behaviour.CAND = (n) => n !== 3;
    await prime();
    expect(await gate()).toBe(EXIT.OK);
  });

  test("--alpha changes the verdict", async () => {
    behaviour.CAND = (n) => n > 4; // loses 4 of 10: p = 0.125
    await prime();
    expect(await gate()).toBe(EXIT.OK);
    expect(await gate("--alpha", "0.2")).toBe(EXIT.GATE_FAILED);
  });

  test("a candidate that was never run exits 2: the gate does not call the API", async () => {
    await main(["run", "--variants", "base"], deps);
    const calls = llm.calls.length;
    expect(await gate()).toBe(EXIT.CACHE_MISS);
    expect(llm.calls).toHaveLength(calls);
    expect(errs.join()).toContain("Run both versions with pf run first");
  });

  test("usage errors exit 64", async () => {
    expect(await main(["gate"], deps)).toBe(EXIT.USAGE);
    expect(await main(["gate", "--baseline", "base", "--candidate", "nope"], deps)).toBe(EXIT.USAGE);
    expect(await gate("--split", "fewshot")).toBe(EXIT.USAGE);
    expect(await gate("--alpha", "5")).toBe(EXIT.USAGE);
  });
});
