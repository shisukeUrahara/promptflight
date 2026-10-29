import { describe, expect, test } from "vitest";
import { verifyFrozen, readFrozen } from "./frozen";
import { renderMessages } from "./render";
import { listVersions, resolveVersion, verifyPrompts } from "./version";

// These tests read the real prompts/ folder of the repo.
const dataDir = process.cwd();
const frozen = readFrozen(dataDir);
const NAMES = ["zero-json", "zero-strict", "few-json", "few-strict"] as const;
const get = (name: string) => resolveVersion(dataDir, frozen[name]);

const sampleCases = [
  { case_id: "t-001", split: "fewshot", text: "I was charged twice for A-11111.", gold: { category: "billing_dispute", priority: "high", order_id: "A-11111" } },
  { case_id: "t-002", split: "fewshot", text: "How do I change my email?", gold: { category: "other", priority: "low", order_id: null } },
  { case_id: "t-003", split: "holdout", text: "HOLDOUT MUST NOT APPEAR", gold: { category: "other", priority: "low", order_id: null } },
] as never;

describe("the 4 variants", () => {
  test("all four are frozen, saved, and the files check out", () => {
    expect(Object.keys(frozen).sort()).toEqual([...NAMES].sort());
    expect(verifyFrozen(dataDir)).toEqual([]);
    expect(verifyPrompts(dataDir)).toEqual([]);
    for (const name of NAMES) expect(listVersions(dataDir, name)).toHaveLength(1);
  });

  test("each factor is set the way its name says", () => {
    expect(get("zero-json")).toMatchObject({ examples: "none", output_mode: "json_prompt" });
    expect(get("zero-strict")).toMatchObject({ examples: "none", output_mode: "json_strict" });
    expect(get("few-json")).toMatchObject({ examples: "fewshot", output_mode: "json_prompt" });
    expect(get("few-strict")).toMatchObject({ examples: "fewshot", output_mode: "json_strict" });
  });

  test("a strict prompt has byte-identical text to its json twin", () => {
    expect(JSON.stringify(get("zero-strict").messages)).toBe(JSON.stringify(get("zero-json").messages));
    expect(JSON.stringify(get("few-strict").messages)).toBe(JSON.stringify(get("few-json").messages));
    expect(get("zero-strict").id).not.toBe(get("zero-json").id); // only output_mode differs
  });

  test("zero-shot and few-shot differ only in the examples block", () => {
    expect(get("zero-json").messages[0]).toEqual(get("few-json").messages[0]);
  });

  test.each(NAMES)("%s renders as expected on a sample ticket", (name) => {
    const rendered = renderMessages(get(name), { ticket: "My app crashes on login. Order A-22222.", cases: sampleCases });
    expect(rendered).toMatchSnapshot();
    expect(rendered.map((m) => m.content).join("\n")).not.toContain("HOLDOUT MUST NOT APPEAR");
    expect(rendered.map((m) => m.content).join("\n")).not.toMatch(/\{\{/);
  });
});
