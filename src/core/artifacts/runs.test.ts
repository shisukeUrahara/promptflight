import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import type { RunManifest } from "./manifest";
import { RunNotFoundError, listRuns, loadRun } from "./runs";
import { writeRunFolder } from "./runFolder";
import type { RunScores } from "./scores";

let dataDir: string;
beforeEach(() => {
  dataDir = mkdtempSync(path.join(tmpdir(), "pf-runs-"));
});

const manifest = (id: string, created: string, split: "tuning" | "holdout" = "tuning"): RunManifest => ({
  run_id: id,
  label: `${split} ${id}`,
  created_at_utc: created,
  split,
  sample_count: 3,
  model: "m",
  variants: { v: "deadbeef" },
  temperature: 0,
  max_completion_tokens: 200,
  dataset_sha256: "c".repeat(64),
  pricing_retrieved_at: "2026-10-29",
  preregistration_sha: null,
  git_sha: "a".repeat(40),
  git_dirty: false,
  allow_dirty: false,
  replay: false,
  cache_hits: 0,
  cache_misses: 0,
  infra_failures: 0,
});
const scores: RunScores = { split: "tuning", model: "m", n_cases: 3, bootstrap: { draws: 10000, seed: 1 }, variants: [], contrasts: [] };
const save = (id: string, created: string, split: "tuning" | "holdout" = "tuning") =>
  writeRunFolder(path.join(dataDir, "experiments", id), { manifest: manifest(id, created, split), results: [], scores });

describe("listRuns", () => {
  test("no experiments folder gives an empty list", () => {
    expect(listRuns(dataDir)).toEqual([]);
  });
  test("lists runs newest first with label, split and size", () => {
    save("20261029T100000Z-tuning", "2026-10-29T10:00:00.000Z");
    save("20261031T101500Z-holdout", "2026-10-31T10:15:00.000Z", "holdout");
    expect(listRuns(dataDir)).toEqual([
      { id: "20261031T101500Z-holdout", label: "holdout 20261031T101500Z-holdout", split: "holdout", created: "2026-10-31T10:15:00.000Z", n: 3 },
      { id: "20261029T100000Z-tuning", label: "tuning 20261029T100000Z-tuning", split: "tuning", created: "2026-10-29T10:00:00.000Z", n: 3 },
    ]);
  });
  test("skips a folder that has no manifest", () => {
    save("20261029T100000Z-tuning", "2026-10-29T10:00:00.000Z");
    mkdirSync(path.join(dataDir, "experiments", "half-written"), { recursive: true });
    expect(listRuns(dataDir).map((r) => r.id)).toEqual(["20261029T100000Z-tuning"]);
  });
});

describe("loadRun", () => {
  test("loads manifest, scores and results", () => {
    save("20261029T100000Z-tuning", "2026-10-29T10:00:00.000Z");
    const run = loadRun(dataDir, "20261029T100000Z-tuning");
    expect(run.manifest.run_id).toBe("20261029T100000Z-tuning");
    expect(run.scores.n_cases).toBe(3);
    expect(run.results).toEqual([]);
  });
  test.each(["..", "../secret", "a/b", "a\\b", "", ".", "x y", "..%2f"])("rejects the id %j", (id) => {
    save("20261029T100000Z-tuning", "2026-10-29T10:00:00.000Z");
    writeFileSync(path.join(dataDir, "secret"), "x");
    expect(() => loadRun(dataDir, id)).toThrow(RunNotFoundError);
  });
  test("an unknown id is RunNotFoundError", () => {
    expect(() => loadRun(dataDir, "nope")).toThrow(RunNotFoundError);
  });
});
