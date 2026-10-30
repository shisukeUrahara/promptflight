import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { readJsonl } from "../dataset/jsonl";
import { Case } from "../domain/case";
import { readFrozen } from "../prompts/frozen";
import { CONTRASTS } from "./scores";

const doc = readFileSync("docs/preregistration.md", "utf8");

test("names every frozen prompt version", () => {
  for (const [name, id] of Object.entries(readFrozen("."))) expect(doc).toContain(`${name} \`${id}\``);
});

test("lists every contrast the scoring code computes, with the same pair", () => {
  for (const c of CONTRASTS) expect(doc).toMatch(new RegExp(`\\| ${c.id} \\| ${c.metric}[^|]*\\| ${c.b} vs ${c.a} \\|`));
});

test("states the holdout size that the dataset really has", () => {
  const holdout = readJsonl("fixtures/tickets/cases.jsonl", Case).filter((c) => c.split === "holdout");
  expect(doc).toContain(`**Holdout:** ${holdout.length} tickets`);
});

test("states the minimum detectable effect from pf power", () => {
  expect(doc).toMatch(/smallest detectable accuracy difference = \*\*0\.\d\d\*\*/);
});
