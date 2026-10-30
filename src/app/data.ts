import path from "node:path";
import { listRuns, loadRun, type LoadedRun, type RunSummary } from "@/core/artifacts/runs";
import { readJsonl } from "@/core/dataset/jsonl";
import { Case } from "@/core/domain/case";
import { loadEnv } from "@/core/env";

/** Server-side data access. Pages call these after `await connection()`, so every request reads the files fresh. */
export const env = () => loadEnv(process.env);
export const dataDir = () => env().dataDir;

export const getRuns = (): RunSummary[] => listRuns(dataDir());
export const getRun = (id: string): LoadedRun => loadRun(dataDir(), id);
export const getCases = (): Case[] => readJsonl(path.join(dataDir(), "fixtures", "tickets", "cases.jsonl"), Case);

/** The run a page shows when none is asked for: the newest holdout run, else the newest run. */
export function pickRun(runs: RunSummary[], asked?: string): RunSummary | undefined {
  return runs.find((r) => r.id === asked) ?? runs.find((r) => r.split === "holdout") ?? runs[0];
}
