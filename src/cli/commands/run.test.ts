import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { NotAGitRepoError } from "@/core/artifacts/git";
import { RunManifest } from "@/core/artifacts/manifest";
import { sha256 } from "@/core/dataset/manifest";
import { writeJsonl } from "@/core/dataset/jsonl";
import type { Case } from "@/core/domain/case";
import { CATEGORIES } from "@/core/domain/labels";
import { FakeLlm, http, ok } from "@/core/llm/fake";
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
    repoState: () => ({ git_sha: "a".repeat(40), git_dirty: false, preregistration_sha: "b".repeat(40) }),
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

describe("pf run guard", () => {
  const dirty = { git_sha: "a".repeat(40), git_dirty: true, preregistration_sha: "b".repeat(40) };

  test("holdout on a dirty tree exits 5 and calls nothing", async () => {
    deps.repoState = () => dirty;
    expect(await main(["run", "--split", "holdout"], deps)).toBe(EXIT.DIRTY_TREE);
    expect(llm.calls).toHaveLength(0);
    expect(errs.join()).toContain("uncommitted");
  });
  test("--allow-dirty lets it through", async () => {
    deps.repoState = () => dirty;
    expect(await main(["run", "--split", "holdout", "--allow-dirty"], deps)).toBe(EXIT.OK);
  });
  test("holdout without a committed pre-registration exits 5, even with --allow-dirty", async () => {
    deps.repoState = () => ({ ...dirty, preregistration_sha: null });
    expect(await main(["run", "--split", "holdout", "--allow-dirty"], deps)).toBe(EXIT.DIRTY_TREE);
  });
  test("tuning on a dirty tree is fine", async () => {
    deps.repoState = () => dirty;
    expect(await main(["run", "--split", "tuning"], deps)).toBe(EXIT.OK);
  });
  test("outside a git checkout exits 5 with a clear message", async () => {
    deps.repoState = () => {
      throw new NotAGitRepoError("/nowhere");
    };
    expect(await main(["run"], deps)).toBe(EXIT.DIRTY_TREE);
    expect(errs.join()).toContain("git checkout");
  });
});

describe("pf run folder", () => {
  const folder = (id: string, name: string) => path.join(dataDir, "experiments", id, name);

  test("writes manifest, results, scores, csv and checksums", async () => {
    await main(["run"], deps);
    const id = runs()[0];
    expect(readdirSync(path.join(dataDir, "experiments", id)).sort()).toEqual(["checksums.txt", "per_case_results.jsonl", "run_manifest.json", "scores.csv", "scores.json"]);
    const manifest = RunManifest.parse(JSON.parse(readFileSync(folder(id, "run_manifest.json"), "utf8")));
    expect(manifest).toMatchObject({
      run_id: id,
      label: "Tuning set · 4 variants · gpt-4.1-mini-2025-04-14 · 31 Oct 2026 10:15 UTC",
      split: "tuning",
      sample_count: 6,
      model: "gpt-4.1-mini-2025-04-14",
      git_dirty: false,
      replay: false,
      cache_misses: 24,
      infra_failures: 0,
    });
    expect(Object.keys(manifest.variants)).toEqual(["zero-json", "zero-strict", "few-json", "few-strict"]);
    expect(manifest.dataset_sha256).toBe(sha256(readFileSync(path.join(dataDir, "fixtures/tickets/cases.jsonl"))));
  });

  test("checksums.txt matches the files (sha256sum -c format)", async () => {
    await main(["run"], deps);
    const id = runs()[0];
    const lines = readFileSync(folder(id, "checksums.txt"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      const [hash, name] = line.split("  ");
      expect(sha256(readFileSync(folder(id, name)))).toBe(hash);
    }
  });

  test("scores.json has no run id or timestamp, and a replay reproduces it byte for byte", async () => {
    await main(["run"], deps);
    now = new Date("2027-01-01T00:00:00Z");
    await main(["run", "--replay"], deps);
    const [first, second] = runs();
    const a = readFileSync(folder(first, "scores.json"), "utf8");
    expect(a).not.toMatch(/run_id|created_at|\d{4}-\d\d-\d\dT|\d{8}T\d{6}Z/);
    expect(readFileSync(folder(second, "scores.json"), "utf8")).toBe(a);
    expect(readFileSync(folder(second, "scores.csv"), "utf8")).toBe(readFileSync(folder(first, "scores.csv"), "utf8"));
    expect(JSON.parse(readFileSync(folder(second, "run_manifest.json"), "utf8")).replay).toBe(true);
  });

  test("all eight contrasts appear in two families, Holm is never below the raw p", async () => {
    await main(["run"], deps);
    const scores = JSON.parse(readFileSync(folder(runs()[0], "scores.json"), "utf8"));
    expect(scores.contrasts.map((c: { id: string; metric: string }) => `${c.id}:${c.metric}`)).toEqual([
      "H1:category", "H2:category", "H3:category", "H4:category",
      "H5:priority", "H6:priority", "H7:priority", "H8:priority",
    ]);
    for (const c of scores.contrasts) {
      expect(c.n_pairs).toBe(6);
      expect(c.counts.both_right + c.counts.both_wrong + c.counts.a_only + c.counts.b_only).toBe(6);
      expect(c.p_holm).toBeGreaterThanOrEqual(c.p);
    }
  });

  test("only the contrasts whose two variants ran are reported", async () => {
    await main(["run", "--variants", "zero-json,few-json"], deps);
    const scores = JSON.parse(readFileSync(folder(runs()[0], "scores.json"), "utf8"));
    expect(scores.contrasts.map((c: { id: string }) => c.id)).toEqual(["H1", "H5"]);
  });

  test("the priority family compares priority answers, with Holm applied within the family", async () => {
    // zero-json always answers priority "low" (right); few-json answers "high" (wrong) on every ticket.
    llm = new FakeLlm((req) =>
      ok(req.messages[1].content.includes("Example 1") ? '{"category":"other","priority":"high","order_id":null}' : answer),
    );
    await main(["run", "--variants", "zero-json,few-json"], deps);
    const scores = JSON.parse(readFileSync(folder(runs()[0], "scores.json"), "utf8"));
    const h5 = scores.contrasts.find((c: { id: string }) => c.id === "H5");
    expect(h5).toMatchObject({ metric: "priority", a: "zero-json", b: "few-json", counts: { a_only: 6, b_only: 0 } });
    expect(h5.accuracy_diff.point).toBe(-1);
    expect(h5.p_holm).toBe(h5.p); // one contrast in its family: nothing to adjust
    const h1 = scores.contrasts.find((c: { id: string }) => c.id === "H1");
    expect(h1.counts.a_only + h1.counts.b_only).toBe(h1.n_pairs - h1.counts.both_right - h1.counts.both_wrong);
  });

  test("prints a summary table with a row per variant", async () => {
    await main(["run"], deps);
    const text = out.join("\n");
    expect(text).toContain("accuracy [95% CI]");
    for (const name of ["zero-json", "zero-strict", "few-json", "few-strict"]) expect(text).toContain(name);
    expect(text).toContain("H1 few-json vs zero-json");
    // columns are separated even when a label is the longest cell
    expect(text).toMatch(/H3 few-strict vs zero-strict {2,}category {2,}\d/);
  });
});

describe("holdout and infrastructure failures", () => {
  test("a call that keeps failing: holdout exits 3 and writes nothing", async () => {
    deps.retryBackoffMs = [0, 0];
    llm = new FakeLlm((req) => (req.messages[1].content.includes("ticket 22") ? http(503) : ok(answer)));
    expect(await main(["run", "--split", "holdout", "--variants", "zero-json"], deps)).toBe(EXIT.INFRA_FAILURES);
    expect(runs()).toEqual([]);
    expect(errs.join("\n")).toContain("zero-json t-022: provider_error 503");
  });

  test("a failure that clears on the second pass is retried once and the run succeeds", async () => {
    deps.retryBackoffMs = [0, 0];
    let failures = 0;
    // 3 failed attempts use up the first pass's retries; the second pass gets through.
    llm = new FakeLlm((req) => (req.messages[1].content.includes("ticket 22") && failures++ < 3 ? http(503) : ok(answer)));
    expect(await main(["run", "--split", "holdout", "--variants", "zero-json"], deps)).toBe(EXIT.OK);
    const manifest = JSON.parse(readFileSync(path.join(dataDir, "experiments", runs()[0], "run_manifest.json"), "utf8"));
    expect(manifest.infra_failures).toBe(0);
    expect(rows(runs()[0])).toHaveLength(3);
  });

  test("when every call fails, even a tuning run exits 3 and writes nothing", async () => {
    deps.retryBackoffMs = [0, 0];
    llm = new FakeLlm(() => http(404));
    expect(await main(["run", "--variants", "zero-json"], deps)).toBe(EXIT.INFRA_FAILURES);
    expect(runs()).toEqual([]);
    expect(errs.join("\n")).toContain("every call failed");
    expect(errs.join("\n")).toContain("provider_error 404");
  });

  test("tuning tolerates a failed call: it is left out of the scores and counted in the manifest", async () => {
    deps.retryBackoffMs = [0, 0];
    llm = new FakeLlm((req) => (req.messages[1].content.includes("ticket 11") ? http(503) : ok(answer)));
    expect(await main(["run", "--variants", "zero-json"], deps)).toBe(EXIT.OK);
    const id = runs()[0];
    expect(JSON.parse(readFileSync(path.join(dataDir, "experiments", id, "run_manifest.json"), "utf8")).infra_failures).toBe(1);
    const scores = JSON.parse(readFileSync(path.join(dataDir, "experiments", id, "scores.json"), "utf8"));
    expect(scores.variants[0]).toMatchObject({ n_total: 6, n_scored: 5, n_infra: 1 });
  });
});

describe("choosing the model", () => {
  const manifestOf = (id: string) => JSON.parse(readFileSync(path.join(dataDir, "experiments", id, "run_manifest.json"), "utf8"));

  test("--model changes the requests, the manifest, the label and the cache file", async () => {
    expect(await main(["run", "--variants", "zero-json", "--model", "gpt-4o-mini-2024-07-18"], deps)).toBe(EXIT.OK);
    expect(llm.calls.every((c) => c.model === "gpt-4o-mini-2024-07-18")).toBe(true);
    const m = manifestOf(runs()[0]);
    expect(m.model).toBe("gpt-4o-mini-2024-07-18");
    expect(m.label).toContain("gpt-4o-mini-2024-07-18");
    expect(readdirSync(path.join(dataDir, "cache/responses"))).toEqual(["gpt-4o-mini-2024-07-18.jsonl"]);
  });

  test("the model can come from deps (PF_MODEL), and the flag wins over it", async () => {
    deps.model = "gpt-4o-mini-2024-07-18";
    await main(["run", "--variants", "zero-json"], deps);
    expect(manifestOf(runs()[0]).model).toBe("gpt-4o-mini-2024-07-18");
    await main(["run", "--variants", "zero-json", "--model", "gpt-4.1-mini-2025-04-14"], deps);
    expect(manifestOf(runs()[1]).model).toBe("gpt-4.1-mini-2025-04-14");
  });

  test("two models do not share cached answers", async () => {
    await main(["run", "--variants", "zero-json"], deps);
    const first = llm.calls.length;
    await main(["run", "--variants", "zero-json", "--model", "gpt-4o-mini-2024-07-18"], deps);
    expect(llm.calls.length).toBe(first * 2);
  });

  test("a model with no price in pricing.json is refused before any call", async () => {
    expect(await main(["run", "--model", "gpt-9-imaginary"], deps)).toBe(EXIT.USAGE);
    expect(errs.join()).toContain('no price for model "gpt-9-imaginary"');
    expect(llm.calls).toHaveLength(0);
  });
});
