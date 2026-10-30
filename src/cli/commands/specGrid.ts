import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { writeManifest } from "@/core/dataset/manifest";
import { buildHardGrid } from "@/core/dataset/hardGrid";
import { SpecRow, buildSpecGrid } from "@/core/dataset/specGrid";
import type { Deps } from "../deps";
import { EXIT } from "../exit";

export const DEFAULT_SEED = 20261029;

export async function specGrid(argv: string[], deps: Deps): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { seed: { type: "string" } } });
  const seed = values.seed === undefined ? DEFAULT_SEED : Number(values.seed);
  if (!Number.isInteger(seed)) {
    deps.err(`--seed must be an integer, got "${values.seed}"`);
    return EXIT.USAGE;
  }
  const first = buildSpecGrid(seed);
  const used = new Set(first.flatMap((r) => (r.order_id ? [r.order_id] : [])));
  const rows = [...first, ...buildHardGrid(seed, used).map((r) => SpecRow.parse(r))];
  const file = path.join(deps.dataDir, "fixtures", "tickets", "spec_grid.jsonl");
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  writeManifest(path.dirname(file));
  deps.out(`wrote ${rows.length} rows to ${file}`);
  return EXIT.OK;
}
