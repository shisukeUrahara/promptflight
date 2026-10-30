import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const doc = readFileSync("docs/analysis.md", "utf8");
const RUNS = ["20261030T122450Z-holdout", "20261030T122723Z-holdout"];

/** Every number in a JSON value, written the ways the doc may write it. */
function forms(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === "number") {
    for (const d of [1, 3, 4]) {
      out.add(value.toFixed(d));
      out.add((value >= 0 ? "+" : "") + value.toFixed(d));
    }
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((v) => forms(v, out));
  }
  return out;
}

const known = new Set<string>();
for (const id of RUNS) forms(JSON.parse(readFileSync(`experiments/${id}/scores.json`, "utf8")), known);
forms(JSON.parse(readFileSync("fixtures/tickets/agreement.json", "utf8")), known);

test("cites both holdout runs", () => {
  for (const id of RUNS) expect(doc).toContain(id);
});

test("every 3- or 4-decimal number in the analysis comes from a cited file", () => {
  const numbers = doc.match(/[+-]?\d+\.\d{3,4}\b/g) ?? [];
  expect(numbers.length).toBeGreaterThan(50);
  const unknown = numbers.filter((n) => !known.has(n) && !known.has(n.replace(/^\+/, "")));
  expect(unknown).toEqual([]);
});
