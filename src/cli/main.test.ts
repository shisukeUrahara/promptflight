import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { NoApiKeyError, type Deps } from "./deps";
import { EXIT } from "./exit";
import { main } from "./main";
import { SpecRow } from "@/core/dataset/specGrid";
import { CATEGORIES, PRIORITIES, SLICES, SPLITS } from "@/core/domain/labels";
import { PAIRS_PER_CATEGORY } from "@/core/domain/pairs";

function fakeDeps() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "pf-"));
  const logs: string[] = [];
  const errs: string[] = [];
  const deps: Deps = {
    dataDir,
    pricingFile: "pricing.json",
    makeLlm: () => {
      throw new NoApiKeyError();
    },
    now: () => new Date("2026-10-29T10:00:00Z"),
    repoState: () => ({ git_sha: "a".repeat(40), git_dirty: false, preregistration_sha: "b".repeat(40) }),
    out: (l) => logs.push(l),
    err: (l) => errs.push(l),
  };
  return { deps, logs, errs, file: path.join(dataDir, "fixtures/tickets/spec_grid.jsonl") };
}

const count = <T>(xs: T[], x: T) => xs.filter((y) => y === x).length;

describe("usage errors", () => {
  test("unknown command exits 64", async () => {
    const { deps, errs } = fakeDeps();
    expect(await main(["nope"], deps)).toBe(EXIT.USAGE);
    expect(errs[0]).toContain("usage");
  });
  test("no command exits 64", async () => {
    expect(await main([], fakeDeps().deps)).toBe(EXIT.USAGE);
  });
  test("unknown option exits 64", async () => {
    expect(await main(["spec-grid", "--bogus"], fakeDeps().deps)).toBe(EXIT.USAGE);
  });
  test("non-integer seed exits 64", async () => {
    expect(await main(["spec-grid", "--seed", "x"], fakeDeps().deps)).toBe(EXIT.USAGE);
  });
});

describe("pf spec-grid", () => {
  const { deps, file } = fakeDeps();
  let rows: SpecRow[];

  test("writes valid rows", async () => {
    expect(await main(["spec-grid"], deps)).toBe(EXIT.OK);
    rows = readFileSync(file, "utf8").trim().split("\n").map((l) => SpecRow.parse(JSON.parse(l)));
    expect(rows).toHaveLength(144);
    expect(new Set(rows.map((r) => r.case_id)).size).toBe(144);
  });

  test("16 per category: 8 clear, 4 ambiguous, 2 injection, 2 noisy", () => {
    for (const category of CATEGORIES) {
      const own = rows.filter((r) => r.intended.category === category);
      expect(own).toHaveLength(16);
      expect(SLICES.map((s) => own.filter((r) => r.slice === s).length)).toEqual([8, 4, 2, 2]);
    }
  });

  test("splits are 1 / 5 / 10 per category and 9 / 45 / 90 overall", () => {
    for (const category of CATEGORIES) {
      const own = rows.filter((r) => r.intended.category === category).map((r) => r.split);
      expect(SPLITS.map((s) => count(own, s))).toEqual([1, 5, 10]);
    }
    expect(SPLITS.map((s) => rows.filter((r) => r.split === s).length)).toEqual([9, 45, 90]);
  });

  test("priority quotas are 36 / 54 / 36 / 18", () => {
    expect(PRIORITIES.map((p) => rows.filter((r) => r.intended.priority === p).length)).toEqual([36, 54, 36, 18]);
  });

  test("order_id: 12 of 16 in billing and shipping, 4 of 16 elsewhere, all unique", () => {
    const heavy = new Set(["billing_refund", "billing_dispute", "shipping_delay", "shipping_damaged"]);
    for (const category of CATEGORIES) {
      const n = rows.filter((r) => r.intended.category === category && r.order_id).length;
      expect(n).toBe(heavy.has(category) ? 12 : 4);
    }
    const ids = rows.flatMap((r) => (r.order_id ? [r.order_id] : []));
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("18 injection rows, each with a target the truth does not already match", () => {
    const inj = rows.filter((r) => r.slice === "injection");
    expect(inj).toHaveLength(18);
    for (const r of inj) {
      expect(r.injection).not.toBeNull();
      const truth = r.injection!.field === "category" ? r.intended.category : r.intended.priority;
      expect(r.injection!.value).not.toBe(truth);
    }
    expect(count(inj.map((r) => r.injection!.field), "priority")).toBe(9);
  });

  test("ambiguous rows carry the pair planned for their category", () => {
    for (const category of CATEGORIES) {
      const ids = rows.filter((r) => r.intended.category === category && r.slice === "ambiguous_pair").map((r) => r.pair_id).sort();
      expect(ids).toEqual([...PAIRS_PER_CATEGORY[category]].sort());
    }
  });

  test("a second run writes identical bytes", async () => {
    const first = readFileSync(file, "utf8");
    await main(["spec-grid"], deps);
    expect(readFileSync(file, "utf8")).toBe(first);
  });
});

describe("pf power", () => {
  test("prints one line with the setup and the answer", async () => {
    const { deps, logs } = fakeDeps();
    expect(await main(["power", "--n", "90"], deps)).toBe(EXIT.OK);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatch(/^N=90, 20% of tickets differ between variants, alpha=0.0125, power=0.8: smallest detectable accuracy difference = 0\.\d\d /);
  });
  test("rejects nonsense", async () => {
    expect(await main(["power", "--n", "0"], fakeDeps().deps)).toBe(EXIT.USAGE);
    expect(await main(["power", "--alpha", "2"], fakeDeps().deps)).toBe(EXIT.USAGE);
  });
});
