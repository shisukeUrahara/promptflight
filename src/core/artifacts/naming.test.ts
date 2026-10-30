import { expect, test } from "vitest";
import { runId, runLabel } from "./naming";

const d = new Date("2026-10-31T10:15:00.123Z");

test("run id is a sortable UTC stamp plus the split", () => {
  expect(runId(d, "holdout")).toBe("20261031T101500Z-holdout");
  expect(runId(new Date("2026-01-02T03:04:05Z"), "tuning")).toBe("20260102T030405Z-tuning");
});

test("run label reads like a sentence, with no zero-padded day", () => {
  expect(runLabel({ split: "holdout", variantCount: 4, createdAt: d })).toBe("Holdout set · 4 variants · 31 Oct 2026 10:15 UTC");
  expect(runLabel({ split: "tuning", variantCount: 1, createdAt: new Date("2026-03-05T09:05:00Z") })).toBe("Tuning set · 1 variant · 5 Mar 2026 09:05 UTC");
  expect(runLabel({ split: "holdout", variantCount: 4, createdAt: d, model: "gpt-4o-mini-2024-07-18" })).toBe(
    "Holdout set · 4 variants · gpt-4o-mini-2024-07-18 · 31 Oct 2026 10:15 UTC",
  );
});
