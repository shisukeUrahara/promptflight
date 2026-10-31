import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import type { RunSummary } from "@/core/artifacts/runs";
import type { PromptSummary } from "@/core/views/overview";
import { Findings } from "./Findings";
import { FlowDiagram } from "./FlowDiagram";
import { PromptCards } from "./PromptCards";
import { RunChips, shortModel } from "./RunChips";
import { VerdictStrip } from "./VerdictStrip";

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


describe("PromptCards", () => {
  const p = (name: string, accuracy: number, highest = false): PromptSummary => ({
    name,
    id: "deadbeef",
    accuracy,
    highest,
    injection: { followed: 6, n: 20 },
    bySlice: { clear: 0.9, ambiguous_pair: 0.8, injection: 0.7, noisy: null },
    promptTokens: 394,
  });
  test("one card per prompt with its accuracy, and only the highest has the pill", () => {
    render(<PromptCards prompts={[p("zero-json", 0.855), p("few-json", 0.906, true)]} runId="r1" />);
    expect(screen.getByTestId("prompt-zero-json")).toHaveTextContent("85.5%");
    expect(screen.getByTestId("prompt-few-json")).toHaveTextContent("Highest");
    expect(screen.getByTestId("prompt-zero-json")).not.toHaveTextContent("Highest");
    expect(screen.getByTestId("prompt-few-json")).toHaveAttribute("href", "/results?run=r1");
  });
  test("the per-type chart lists every type, a missing type as 0%", () => {
    render(<PromptCards prompts={[p("zero-json", 0.855)]} runId="r1" />);
    expect(screen.getByRole("img", { name: "zero-json accuracy by ticket type: clear 90, ambig. 80, inject. 70, noisy 0" })).toBeInTheDocument();
    expect(screen.getByTestId("prompt-zero-json")).toHaveTextContent("6/20");
  });
});

describe("VerdictStrip", () => {
  const largest = {
    id: "H1", metric: "category" as const, a: "zero-json", b: "few-json", question: "q", n_pairs: 138,
    counts: { both_right: 115, both_wrong: 10, a_only: 3, b_only: 10 }, p: 0.092, p_holm: 0.369,
    accuracy_diff: { point: 0.0507, lo: 0, hi: 0.1 },
  };
  test("not shown: says so with the largest gap, Holm p and detectable gap", () => {
    render(<VerdictStrip verdict={{ anyShown: false, largest }} comparisons={4} detectable={0.13} preregistered runId="r" />);
    const strip = screen.getByRole("region", { name: "Verdict" });
    expect(strip).toHaveTextContent("No prompt wins clearly.");
    expect(strip).toHaveTextContent("Largest gap +5.1 points (few-json vs zero-json). After correcting for 4 comparisons, p = 0.369. The test could detect about 13 points.");
    expect(strip).toHaveTextContent("Pre-registered");
    expect(strip).toHaveTextContent("No significant difference");
  });
  test("shown: the headline and pill change", () => {
    render(<VerdictStrip verdict={{ anyShown: true, largest: { ...largest, p_holm: 0.01 } }} comparisons={4} detectable={null} preregistered={false} runId="r" />);
    const strip = screen.getByRole("region", { name: "Verdict" });
    expect(strip).toHaveTextContent("One prompt wins on this run.");
    expect(strip).toHaveTextContent("Significant difference");
    expect(strip).not.toHaveTextContent("Pre-registered");
    expect(strip).not.toHaveTextContent("could detect");
  });
});

describe("FlowDiagram", () => {
  test("lists the steps in order with the real counts and model", () => {
    render(<FlowDiagram tickets={204} prompts={["zero-json", "few-json"]} model="gpt-4o-mini" />);
    const region = screen.getByRole("region", { name: "How it works" });
    expect(region).toHaveTextContent(/204 tickets.*labeled blind.*2 prompts:.*zero-json.*few-json.*gpt-4o-mini.*Checker.*schema \+ label.*Scores/);
  });
});

describe("Findings", () => {
  const base = {
    nCases: 138,
    prompts: [
      { name: "zero-json", id: "a", accuracy: 0.855, highest: false, injection: { followed: 6, n: 20 }, bySlice: { clear: 1, ambiguous_pair: 1, injection: 1, noisy: 1 }, promptTokens: 394 },
      { name: "few-json", id: "b", accuracy: 0.906, highest: true, injection: { followed: 5, n: 20 }, bySlice: { clear: 1, ambiguous_pair: 1, injection: 1, noisy: 1 }, promptTokens: 1167 },
    ],
    verdict: {
      anyShown: false,
      largest: { id: "H1", metric: "category" as const, a: "zero-json", b: "few-json", question: "q", n_pairs: 138, counts: { both_right: 115, both_wrong: 10, a_only: 3, b_only: 10 }, p: 0.092, p_holm: 0.369, accuracy_diff: { point: 0.0507, lo: 0, hi: 0.1 } },
    },
    validity: 1,
    injection: { min: 5, max: 6, n: 20 },
    promptTokens: { min: 394, max: 1167 },
    runCostUsd: 0.07,
    alwaysWrong: { count: 10, topGold: { label: "product_bug", count: 7 }, topAnswer: { label: "account_security", count: 12 } },
  };
  test("three cards with computed numbers and links to their tickets", () => {
    render(<Findings o={base} runId="r1" detectable={0.13} />);
    const cards = screen.getAllByRole("listitem").filter((li) => li.querySelector("h3"));
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Hidden instructions work");
    expect(cards[0]).toHaveTextContent("5–6 of 20");
    expect(cards[1]).toHaveTextContent("No prompt wins clearly");
    expect(cards[1]).toHaveTextContent("+5.1 pts");
    expect(cards[1]).toHaveTextContent("p 0.369");
    expect(cards[1]).toHaveTextContent("≈13 pts");
    expect(cards[2]).toHaveTextContent("mostly product_bug, answered account_security");
    const links = screen.getAllByRole("link", { name: "View tickets ›" }).map((a) => a.getAttribute("href"));
    expect(links).toEqual(["/cases?run=r1&slice=injection", "/cases?run=r1&disagree=1", "/cases?run=r1&allwrong=1"]);
  });
  test("no injection obeyed reads as holding", () => {
    render(<Findings o={{ ...base, injection: { min: 0, max: 0, n: 20 } }} runId="r1" detectable={null} />);
    expect(screen.getByText("Hidden instructions are ignored")).toBeInTheDocument();
    expect(screen.getByText("Holding")).toBeInTheDocument();
  });
});
