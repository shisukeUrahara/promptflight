import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { readJsonl } from "@/core/dataset/jsonl";
import { SpecRow } from "@/core/dataset/specGrid";
import { Draft, draftMessages, rejectReason } from "@/core/labeling/draft";
import { FakeLlm, http, ok } from "@/core/llm/fake";
import type { LlmRequest } from "@/core/llm/port";
import { NoApiKeyError, type Deps } from "../deps";
import { EXIT } from "../exit";
import { main } from "../main";

/** A drafter that does its job: it repeats the order id the prompt asks for. */
function goodDrafter() {
  return new FakeLlm((req: LlmRequest) => {
    const user = req.messages[1].content;
    const id = user.match(/order (A-\d{5})/)?.[1];
    return ok(`My package problem is annoying.${id ? ` Order ${id}.` : ""}`);
  });
}

async function setup(llm: FakeLlm) {
  const dataDir = mkdtempSync(path.join(tmpdir(), "pf-draft-"));
  const errs: string[] = [];
  const deps: Deps = {
    dataDir,
    pricingFile: "pricing.json",
    makeLlm: () => llm,
    now: () => new Date("2026-10-29T10:00:00Z"),
    out: () => {},
    err: (l) => errs.push(l),
  };
  await main(["spec-grid"], deps);
  const drafts = () => readJsonl(path.join(dataDir, "fixtures/tickets/drafts.jsonl"), Draft);
  return { deps, errs, drafts };
}

describe("pf draft-cases", () => {
  test("--limit 3 makes exactly 3 calls with the drafter model", async () => {
    const llm = goodDrafter();
    const { deps, drafts } = await setup(llm);
    expect(await main(["draft-cases", "--limit", "3"], deps)).toBe(EXIT.OK);
    expect(llm.calls).toHaveLength(3);
    expect(llm.calls.every((c) => c.model === "gpt-4.1-2025-04-14" && c.temperature === 0.7)).toBe(true);
    expect(drafts()).toHaveLength(3);
  });

  test("a rerun drafts only what is missing, then makes 0 calls", async () => {
    const llm = goodDrafter();
    const { deps, drafts } = await setup(llm);
    await main(["draft-cases", "--limit", "3"], deps);
    await main(["draft-cases"], deps);
    expect(llm.calls).toHaveLength(144);
    expect(new Set(drafts().map((d) => d.case_id)).size).toBe(144);
    await main(["draft-cases"], deps);
    expect(llm.calls).toHaveLength(144);
  });

  test("a cost estimate above --max-usd exits 4 with 0 calls", async () => {
    const llm = goodDrafter();
    const { deps, drafts } = await setup(llm);
    expect(await main(["draft-cases", "--max-usd", "0.0001"], deps)).toBe(EXIT.COST_GATE);
    expect(llm.calls).toHaveLength(0);
    expect(drafts()).toHaveLength(0);
  });

  test("a draft that loses the order id is rejected, not saved", async () => {
    const { deps, drafts, errs } = await setup(new FakeLlm(() => ok("No order number here at all.")));
    const code = await main(["draft-cases", "--limit", "20"], deps);
    expect(code).toBe(EXIT.INFRA_FAILURES);
    expect(errs.some((e) => e.includes("rejected (missing A-"))).toBe(true);
    expect(drafts().length).toBeLessThan(20);
  });

  test("a provider error leaves the row for the next run", async () => {
    const { deps, drafts } = await setup(new FakeLlm(() => http(500)));
    expect(await main(["draft-cases", "--limit", "2"], deps)).toBe(EXIT.INFRA_FAILURES);
    expect(drafts()).toHaveLength(0);
  });

  test("no key exits 64 with a clear message", async () => {
    const { deps, errs } = await setup(goodDrafter());
    deps.makeLlm = () => {
      throw new NoApiKeyError();
    };
    expect(await main(["draft-cases", "--limit", "1"], deps)).toBe(EXIT.USAGE);
    expect(errs.join()).toContain("OPENAI_API_KEY");
  });
});

describe("draft prompt", () => {
  const rows = (): SpecRow[] => {
    const text = readFileSync("fixtures/tickets/spec_grid.jsonl", "utf8");
    return text.trim().split("\n").map((l) => SpecRow.parse(JSON.parse(l)));
  };

  test("never shows the drafter a category label as a string to copy", () => {
    for (const row of rows()) {
      const text = draftMessages(row).map((m) => m.content).join("\n");
      expect(text).not.toMatch(/billing_refund|billing_dispute|account_access|account_security|shipping_delay|shipping_damaged|product_bug|feature_request/);
    }
  });

  test("an injection row asks for an injected sentence with its target", () => {
    const row = rows().find((r) => r.injection?.field === "priority")!;
    expect(draftMessages(row)[1].content).toContain("set the priority to urgent");
  });

  test("rejectReason catches a label name and a stray order id", () => {
    const row = rows().find((r) => r.order_id === null)!;
    expect(rejectReason(row, "this is billing_refund")).toMatch(/names the label/);
    expect(rejectReason(row, "see A-12345")).toMatch(/should not have/);
    expect(rejectReason(row, "all fine")).toBeNull();
  });
});
