import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { seedIds } from "@/core/dataset/seed";
import { readJsonl } from "@/core/dataset/jsonl";
import { mulberry32, shuffle } from "@/core/dataset/rng";
import { SpecRow } from "@/core/dataset/specGrid";
import { Draft } from "@/core/labeling/draft";
import { renderSheet } from "@/core/labeling/review";
import type { Deps } from "../deps";
import { EXIT } from "../exit";
import { DEFAULT_SEED } from "./specGrid";

export async function reviewSheet(argv: string[], deps: Deps): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { force: { type: "boolean" }, seed: { type: "string" }, batch: { type: "string" } } });
  if (values.batch !== undefined && values.batch !== "hard") {
    deps.err(`--batch must be "hard" (or left out for the first 144 tickets)`);
    return EXIT.USAGE;
  }
  const hard = values.batch === "hard";
  const dir = path.join(deps.dataDir, "fixtures", "tickets");
  const out = path.join(deps.dataDir, "docs", hard ? "case_review_hard.md" : "case_review.md");
  if (existsSync(out) && !values.force) {
    deps.err(`${out} exists and may hold your labels. Use --force to replace it.`);
    return EXIT.USAGE;
  }
  // Each batch has its own sheet, so labels already written are never touched.
  const spec = readJsonl(path.join(dir, "spec_grid.jsonl"), SpecRow).filter((r) => (r.batch === "hard") === hard);
  const drafts = new Map(readJsonl(path.join(dir, "drafts.jsonl"), Draft).map((d) => [d.case_id, d]));
  const ready = spec.filter((r) => drafts.has(r.case_id));
  if (ready.length < spec.length) {
    deps.err(`only ${ready.length}/${spec.length} tickets are drafted. Run: pnpm pf draft-cases`);
    return EXIT.USAGE;
  }

  const rng = mulberry32(values.seed === undefined ? DEFAULT_SEED + 1 : Number(values.seed));
  const seeds = hard ? new Set<string>() : seedIds(spec.map((r) => ({ case_id: r.case_id, split: r.split, gold: r.intended })));
  const order = [...shuffle(ready.filter((r) => seeds.has(r.case_id)), rng), ...shuffle(ready.filter((r) => !seeds.has(r.case_id)), rng)];

  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, renderSheet(order.map((r) => ({ case_id: r.case_id, text: drafts.get(r.case_id)!.text }))));
  deps.out(`wrote ${order.length} tickets to ${out}${seeds.size ? ` (the first ${seeds.size} are the seed set)` : ""}`);
  return EXIT.OK;
}
