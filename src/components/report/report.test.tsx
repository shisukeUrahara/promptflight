import { render, screen, within } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { RunManifest } from "@/core/artifacts/manifest";
import type { RunScores } from "@/core/artifacts/scores";
import { KpiCards } from "./KpiCards";
import { ManifestStrip } from "./ManifestStrip";

// The synthetic UI fixture; its numbers are made up, which is fine for a rendering test.
const root = "e2e/fixtures/data/experiments";
const holdout = readdirSync(root).find((d) => d.endsWith("-holdout"))!;
const scores: RunScores = JSON.parse(readFileSync(`${root}/${holdout}/scores.json`, "utf8"));
const manifest: RunManifest = JSON.parse(readFileSync(`${root}/${holdout}/run_manifest.json`, "utf8"));

describe("KpiCards", () => {
  test("one card per variant, with the accuracy from scores.json", () => {
    render(<KpiCards variants={scores.variants} runId={holdout} />);
    const cards = within(screen.getByRole("list", { name: "Variants" })).getAllByRole("listitem");
    expect(cards).toHaveLength(scores.variants.length);
    for (const v of scores.variants) {
      expect(screen.getByTestId(`acc-${v.variant}`)).toHaveTextContent(v.accuracy.toFixed(3));
    }
  });

  test("each card links to its tickets", () => {
    render(<KpiCards variants={scores.variants} runId={holdout} />);
    const links = screen.getAllByRole("link", { name: "See its tickets" });
    expect(links[0]).toHaveAttribute("href", `/cases?run=${holdout}&variant=${scores.variants[0].variant}`);
  });

  test("shows injections as followed out of n", () => {
    render(<KpiCards variants={scores.variants} runId={holdout} />);
    const v = scores.variants[0];
    expect(screen.getAllByText(`${v.injection.followed}/${v.injection.n}`).length).toBeGreaterThan(0);
  });
});

describe("ManifestStrip", () => {
  test("shows model, size, git and tree state", () => {
    render(<ManifestStrip m={manifest} />);
    const strip = screen.getByRole("list", { name: "Run manifest" });
    expect(strip).toHaveTextContent(manifest.model);
    expect(strip).toHaveTextContent(`N=${manifest.sample_count}`);
    expect(strip).toHaveTextContent(`git ${manifest.git_sha.slice(0, 8)}`);
    expect(strip).toHaveTextContent("clean tree");
  });

  test("warns about a dirty tree", () => {
    render(<ManifestStrip m={{ ...manifest, git_dirty: true }} />);
    expect(screen.getByRole("list", { name: "Run manifest" })).toHaveTextContent("uncommitted changes");
  });
});
