import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { RunSummary } from "@/core/artifacts/runs";
import { RunChips, shortModel } from "./RunChips";

const run = (id: string, model: string, split: "holdout" | "tuning" = "holdout", created = "2026-10-30T12:00:00Z"): RunSummary => ({ id, label: id, split, created, n: 138, model });

describe("RunChips", () => {
  test("one chip per holdout run, named by short model, current marked", () => {
    render(<RunChips runs={[run("a", "gpt-4o-mini-2024-07-18"), run("b", "gpt-4.1-mini-2025-04-14"), run("c", "x", "tuning")]} current="a" basePath="/" />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["gpt-4o-mini", "gpt-4.1-mini"]);
    expect(links[0]).toHaveAttribute("aria-current", "true");
    expect(links[1]).toHaveAttribute("href", "/?run=b");
  });
  test("two runs of one model are told apart by date", () => {
    render(<RunChips runs={[run("a", "m-2024-07-18", "holdout", "2026-10-30T00:00:00Z"), run("b", "m-2024-07-18", "holdout", "2026-10-31T00:00:00Z")]} current="a" basePath="/" />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["m2026-10-30", "m2026-10-31"]);
  });
  test("with no holdout run, all runs are offered", () => {
    render(<RunChips runs={[run("t", "m", "tuning")]} current="t" basePath="/results" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/results?run=t");
  });
});

test("shortModel drops the snapshot date only", () => {
  expect(shortModel("gpt-4o-mini-2024-07-18")).toBe("gpt-4o-mini");
  expect(shortModel("gpt-4o-mini")).toBe("gpt-4o-mini");
});
