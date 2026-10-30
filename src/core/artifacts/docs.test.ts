import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("every path the code tour cites exists", () => {
  const tour = readFileSync("docs/CODE_TOUR.md", "utf8");
  const paths = [...tour.matchAll(/`([\w./-]+\/[\w./-]*|[\w-]+\.(?:ts|tsx|mjs|json|md))`/g)].map((m) => m[1]);
  expect(paths.length).toBeGreaterThan(30);
  expect(paths.filter((p) => !existsSync(p))).toEqual([]);
});

test("every ADR has a decision and its limits", () => {
  for (const n of ["0001-dataset-protocol", "0002-two-by-two-and-statistics", "0003-response-cache-and-replay"]) {
    const adr = readFileSync(`docs/adr/${n}.md`, "utf8");
    expect(adr).toContain("**Decision.**");
    expect(adr).toContain("**Limits.**");
  }
});
