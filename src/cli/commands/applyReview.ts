import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readJsonl, writeJsonl } from "@/core/dataset/jsonl";
import { writeManifest } from "@/core/dataset/manifest";
import { SpecRow } from "@/core/dataset/specGrid";
import { Draft } from "@/core/labeling/draft";
import { buildCases, parseFinals, parseSheet, renderDisagreements } from "@/core/labeling/review";
import type { Deps } from "../deps";
import { EXIT } from "../exit";

const pct = (n: number) => (n * 100).toFixed(1) + "%";

export async function applyReview(_argv: string[], deps: Deps): Promise<number> {
  const dir = path.join(deps.dataDir, "fixtures", "tickets");
  const sheetFile = path.join(deps.dataDir, "docs", "case_review.md");
  const hardFile = path.join(deps.dataDir, "docs", "case_review_hard.md");
  const disFile = path.join(deps.dataDir, "docs", "case_disagreements.md");
  if (!existsSync(sheetFile)) {
    deps.err("no docs/case_review.md. Run: pnpm pf review-sheet");
    return EXIT.USAGE;
  }

  const built = buildCases(
    readJsonl(path.join(dir, "spec_grid.jsonl"), SpecRow),
    readJsonl(path.join(dir, "drafts.jsonl"), Draft),
    // The first batch's sheet plus the hard batch's sheet, if it exists.
    { labels: new Map([sheetFile, hardFile].filter((f) => existsSync(f)).flatMap((f) => [...parseSheet(readFileSync(f, "utf8")).labels])) },
    existsSync(disFile) ? parseFinals(readFileSync(disFile, "utf8")) : new Map(),
  );
  if (built.errors.length > 0) {
    built.errors.forEach((e) => deps.err(e));
    return EXIT.GATE_FAILED;
  }

  writeJsonl(path.join(dir, "cases.jsonl"), built.cases);
  writeFileSync(path.join(dir, "agreement.json"), JSON.stringify(built.stats, null, 2) + "\n");
  writeFileSync(
    disFile,
    renderDisagreements(built.disagreements, existsSync(disFile) ? parseFinals(readFileSync(disFile, "utf8")) : new Map()),
  );
  writeManifest(dir);

  const s = built.stats;
  deps.out(`labeled ${s.labeled}/${s.total}`);
  if (s.category && s.priority) {
    deps.out(`category: agreement ${pct(s.category.agreement)}, kappa ${s.category.kappa.toFixed(3)}`);
    deps.out(`priority: agreement ${pct(s.priority.agreement)}, kappa ${s.priority.kappa.toFixed(3)}`);
  }
  deps.out(`disagreements ${s.disagreements}, waiting for your decision ${s.pending_adjudication} (see docs/case_disagreements.md)`);
  return EXIT.OK;
}
