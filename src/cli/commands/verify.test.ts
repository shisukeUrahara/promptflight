import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { Deps } from "../deps";
import { EXIT } from "../exit";
import { main } from "../main";

function setup() {
  const dataDir = mkdtempSync(path.join(tmpdir(), "pf-verify-"));
  const errs: string[] = [];
  const deps: Deps = {
    dataDir,
    pricingFile: "pricing.json",
    makeLlm: () => {
      throw new Error("no llm");
    },
    now: () => new Date(),
    out: () => {},
    err: (l) => errs.push(l),
  };
  return { deps, errs, grid: path.join(dataDir, "fixtures/tickets/spec_grid.jsonl") };
}

describe("pf verify", () => {
  test("passes right after spec-grid wrote the manifest", async () => {
    const { deps } = setup();
    await main(["spec-grid"], deps);
    expect(await main(["verify"], deps)).toBe(EXIT.OK);
  });

  test("one changed byte exits 1 and names the file", async () => {
    const { deps, errs, grid } = setup();
    await main(["spec-grid"], deps);
    appendFileSync(grid, " ");
    expect(await main(["verify"], deps)).toBe(EXIT.GATE_FAILED);
    expect(errs).toEqual(["checksum mismatch: spec_grid.jsonl"]);
  });

  test("a deleted file exits 1", async () => {
    const { deps, errs, grid } = setup();
    await main(["spec-grid"], deps);
    rmSync(grid);
    expect(await main(["verify"], deps)).toBe(EXIT.GATE_FAILED);
    expect(errs).toEqual(["missing: spec_grid.jsonl"]);
  });

  test("a missing manifest exits 1", async () => {
    const { deps } = setup();
    expect(await main(["verify"], deps)).toBe(EXIT.GATE_FAILED);
  });
});
