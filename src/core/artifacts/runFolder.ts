import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sha256 } from "../dataset/manifest";
import { writeJsonl } from "../dataset/jsonl";
import type { CaseResult } from "../runner/types";
import type { RunManifest } from "./manifest";
import { scoresToCsv, type RunScores } from "./scores";

export const RUN_FILES = ["run_manifest.json", "per_case_results.jsonl", "scores.json", "scores.csv"] as const;

/** Write a finished run. checksums.txt goes last and covers the other files (sha256sum -c compatible). */
export function writeRunFolder(dir: string, run: { manifest: RunManifest; results: readonly CaseResult[]; scores: RunScores }): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "run_manifest.json"), JSON.stringify(run.manifest, null, 2) + "\n");
  writeJsonl(path.join(dir, "per_case_results.jsonl"), run.results);
  writeFileSync(path.join(dir, "scores.json"), JSON.stringify(run.scores, null, 2) + "\n");
  writeFileSync(path.join(dir, "scores.csv"), scoresToCsv(run.scores));
  const lines = [...RUN_FILES].sort().map((name) => `${sha256(readFileSync(path.join(dir, name)))}  ${name}`);
  writeFileSync(path.join(dir, "checksums.txt"), lines.join("\n") + "\n");
}
