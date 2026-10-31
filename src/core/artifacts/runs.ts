import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { readJsonl } from "../dataset/jsonl";
import { CaseResult } from "../runner/types";
import { RunManifest } from "./manifest";
import type { RunScores } from "./scores";

export class RunNotFoundError extends Error {
  constructor(id: string) {
    super(`no run "${id}"`);
    this.name = "RunNotFoundError";
  }
}

/** A run id becomes a folder name, so only plain characters are allowed: no "/", no "..". */
const SAFE_ID = /^[0-9A-Za-z_-]+$/;

export interface RunSummary {
  id: string;
  label: string;
  split: string;
  created: string;
  n: number;
  model: string;
}

const experimentsDir = (dataDir: string) => path.join(dataDir, "experiments");
const readManifest = (dir: string) => RunManifest.parse(JSON.parse(readFileSync(path.join(dir, "run_manifest.json"), "utf8")));

/** Every finished run, newest first. A folder without a manifest is not a finished run and is skipped. */
export function listRuns(dataDir: string): RunSummary[] {
  const root = experimentsDir(dataDir);
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && SAFE_ID.test(e.name) && existsSync(path.join(root, e.name, "run_manifest.json")))
    .map((e) => {
      const m = readManifest(path.join(root, e.name));
      return { id: e.name, label: m.label, split: m.split, created: m.created_at_utc, n: m.sample_count, model: m.model };
    })
    .sort((a, b) => b.created.localeCompare(a.created) || b.id.localeCompare(a.id));
}

export interface LoadedRun {
  manifest: RunManifest;
  scores: RunScores;
  results: CaseResult[];
}

export function loadRun(dataDir: string, id: string): LoadedRun {
  if (!SAFE_ID.test(id)) throw new RunNotFoundError(id);
  const dir = path.join(experimentsDir(dataDir), id);
  if (!existsSync(path.join(dir, "run_manifest.json"))) throw new RunNotFoundError(id);
  return {
    manifest: readManifest(dir),
    scores: JSON.parse(readFileSync(path.join(dir, "scores.json"), "utf8")) as RunScores,
    results: readJsonl(path.join(dir, "per_case_results.jsonl"), CaseResult),
  };
}
