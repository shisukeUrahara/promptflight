import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { readJsonl } from "@/core/dataset/jsonl";
import { seedIds } from "@/core/dataset/seed";
import { SpecRow } from "@/core/dataset/specGrid";
import { Case } from "@/core/domain/case";
import type { Deps } from "../deps";
import { EXIT } from "../exit";
import { main } from "../main";

let dataDir: string;
let out: string[];
let errs: string[];
let deps: Deps;

const sheet = () => path.join(dataDir, "docs/case_review.md");
const readSheet = () => readFileSync(sheet(), "utf8");
const spec = () => readJsonl(path.join(dataDir, "fixtures/tickets/spec_grid.jsonl"), SpecRow);
const cases = () => readJsonl(path.join(dataDir, "fixtures/tickets/cases.jsonl"), Case);

/** Fill the fields of one ticket in the sheet text. */
function fill(md: string, id: string, category: string, priority: string) {
  return md.replace(new RegExp(`(### ${id}\\n[\\s\\S]*?)category: \\npriority: `), `$1category: ${category}\npriority: ${priority}`);
}

beforeEach(() => {
  // The committed drafts are the fixture: 144 real tickets.
  dataDir = mkdtempSync(path.join(tmpdir(), "pf-review-"));
  mkdirSync(path.join(dataDir, "fixtures"), { recursive: true });
  cpSync("fixtures/tickets", path.join(dataDir, "fixtures/tickets"), { recursive: true });
  out = [];
  errs = [];
  deps = {
    dataDir,
    pricingFile: "pricing.json",
    makeLlm: () => {
      throw new Error("no llm");
    },
    now: () => new Date("2026-10-29T10:00:00Z"),
    repoState: () => ({ git_sha: "a".repeat(40), git_dirty: false, preregistration_sha: "b".repeat(40) }),
    out: (l) => out.push(l),
    err: (l) => errs.push(l),
  };
});

describe("pf review-sheet", () => {
  test("the sheet never shows an intended label next to a ticket", async () => {
    expect(await main(["review-sheet"], deps)).toBe(EXIT.OK);
    const md = readSheet();
    expect(md).not.toMatch(/intended/i);
    const blocks = md.split(/^### /m).slice(1);
    expect(blocks).toHaveLength(144);
    for (const b of blocks) expect(b).toMatch(/\n> [\s\S]*\ncategory: \npriority: \n+$/);
  });

  test("the seed set comes first, and the rest is not grouped by category", async () => {
    await main(["review-sheet"], deps);
    const ids = [...readSheet().matchAll(/^### (t-\d{3})$/gm)].map((m) => m[1]);
    const rows = spec();
    const seeds = seedIds(rows.map((r) => ({ case_id: r.case_id, split: r.split, gold: r.intended })));
    expect(seeds.size).toBe(27);
    expect(new Set(ids.slice(0, 27))).toEqual(seeds);
    const cat = new Map(rows.map((r) => [r.case_id, r.intended.category]));
    const rest = ids.slice(27).map((id) => cat.get(id));
    const changes = rest.filter((c, i) => i > 0 && c !== rest[i - 1]).length;
    expect(changes).toBeGreaterThan(80); // 117 rows in 9 blocks would give 8
    expect(ids.slice(27)).not.toEqual([...ids.slice(27)].sort());
  });

  test("it will not overwrite a sheet that may hold labels", async () => {
    await main(["review-sheet"], deps);
    writeFileSync(sheet(), fill(readSheet(), "t-001", "other", "low"));
    expect(await main(["review-sheet"], deps)).toBe(EXIT.USAGE);
    expect(readSheet()).toContain("category: other");
    expect(await main(["review-sheet", "--force"], deps)).toBe(EXIT.OK);
    expect(readSheet()).not.toContain("category: other");
  });
});

describe("pf apply-review", () => {
  const pick = (n: number) => spec().slice(0, n);

  test("3 filled rows give 3 cases, and the rest stay unlabeled", async () => {
    await main(["review-sheet"], deps);
    let md = readSheet();
    for (const r of pick(3)) md = fill(md, r.case_id, r.intended.category, r.intended.priority);
    writeFileSync(sheet(), md);
    expect(await main(["apply-review"], deps)).toBe(EXIT.OK);
    expect(cases()).toHaveLength(3);
    expect(out.join("\n")).toContain("labeled 3/144");
    expect(out.join("\n")).toMatch(/category: agreement 100\.0%/);
    const c = cases()[0];
    const row = spec().find((r) => r.case_id === c.case_id)!;
    expect(c.gold).toEqual({ ...row.intended, order_id: row.order_id });
    expect(c.provenance.adjudicated).toBe(false);
  });

  test("a disagreement is listed, and the final answer becomes gold", async () => {
    await main(["review-sheet"], deps);
    const [a, b] = pick(2);
    const wrong = a.intended.category === "other" ? "billing_refund" : "other";
    let md = readSheet();
    md = fill(md, a.case_id, wrong, a.intended.priority);
    md = fill(md, b.case_id, b.intended.category, b.intended.priority);
    writeFileSync(sheet(), md);
    await main(["apply-review"], deps);

    const disFile = path.join(dataDir, "docs/case_disagreements.md");
    const dis = readFileSync(disFile, "utf8");
    expect(dis).toContain(`### ${a.case_id}`);
    expect(dis).not.toContain(`### ${b.case_id}`);
    expect(out.join("\n")).toContain("disagreements 1, waiting for your decision 1");
    let c = cases().find((x) => x.case_id === a.case_id)!;
    expect(c.gold.category).toBe(wrong); // no decision yet: the human label stands
    expect(c.provenance.adjudicated).toBe(false);

    writeFileSync(disFile, dis.replace("final category: ", `final category: ${a.intended.category}`));
    out.length = 0;
    await main(["apply-review"], deps);
    c = cases().find((x) => x.case_id === a.case_id)!;
    expect(c.gold.category).toBe(a.intended.category);
    expect(c.provenance).toMatchObject({ adjudicated: true, human_label: { category: wrong } });
    expect(out.join("\n")).toContain("waiting for your decision 0");
    // the decision survives a rewrite of the file
    expect(readFileSync(disFile, "utf8")).toContain(`final category: ${a.intended.category}`);
  });

  test("an unknown label exits 1 and names the ticket", async () => {
    await main(["review-sheet"], deps);
    const r = pick(1)[0];
    writeFileSync(sheet(), fill(readSheet(), r.case_id, "billing", "high"));
    expect(await main(["apply-review"], deps)).toBe(EXIT.GATE_FAILED);
    expect(errs.join()).toContain(`${r.case_id}: unknown category "billing"`);
  });

  test("a half-filled ticket is skipped, not guessed", async () => {
    await main(["review-sheet"], deps);
    const r = pick(1)[0];
    writeFileSync(sheet(), readSheet().replace(new RegExp(`(### ${r.case_id}\\n[\\s\\S]*?)category: `), `$1category: other`));
    await main(["apply-review"], deps);
    expect(cases()).toHaveLength(0);
  });

  test("without a sheet it says what to run", async () => {
    expect(await main(["apply-review"], deps)).toBe(EXIT.USAGE);
    expect(errs.join()).toContain("review-sheet");
  });

  test("the manifest follows cases.jsonl, so pf verify passes", async () => {
    await main(["review-sheet"], deps);
    const r = pick(1)[0];
    writeFileSync(sheet(), fill(readSheet(), r.case_id, r.intended.category, r.intended.priority));
    await main(["apply-review"], deps);
    expect(await main(["verify"], deps)).toBe(EXIT.OK);
  });
});
