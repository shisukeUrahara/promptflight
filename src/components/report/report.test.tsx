import { render, screen, within } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import type { RunManifest } from "@/core/artifacts/manifest";
import type { RunScores } from "@/core/artifacts/scores";
import { FailureTable } from "./Bars";
import { ConfusionMatrix } from "./ConfusionMatrix";
import { ContrastGrid } from "./ContrastGrid";
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
      expect(screen.getByTestId(`acc-${v.variant}`)).toHaveTextContent(`${(v.accuracy * 100).toFixed(1)}%`);
    }
  });

  test("each card links to its tickets", () => {
    render(<KpiCards variants={scores.variants} runId={holdout} />);
    const links = screen.getAllByRole("link", { name: "See its tickets ›" });
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


describe("ContrastGrid", () => {
  const base = scores.contrasts[0];
  test("one tile per contrast with its paired counts", () => {
    render(<ContrastGrid contrasts={scores.contrasts.filter((c) => c.metric === "category")} />);
    for (const c of scores.contrasts.filter((c) => c.metric === "category")) {
      const tile = screen.getByTestId(`contrast-${c.id}`);
      expect(tile).toHaveTextContent(`Only ${c.a} right${c.counts.a_only}`);
      expect(tile).toHaveTextContent(`Only ${c.b} right${c.counts.b_only}`);
    }
  });
  test("'shown' only when the Holm p is below 0.05", () => {
    render(<ContrastGrid contrasts={[{ ...base, id: "X1", p_holm: 0.049 }, { ...base, id: "X2", p_holm: 0.05 }]} />);
    expect(screen.getByTestId("contrast-X1")).toHaveTextContent("shown");
    expect(screen.getByTestId("contrast-X1")).not.toHaveTextContent("not shown");
    expect(screen.getByTestId("contrast-X2")).toHaveTextContent("not shown");
  });
  test("says so when no comparison can be made", () => {
    render(<ContrastGrid contrasts={[]} />);
    expect(screen.getByText(/does not have both variants/)).toBeInTheDocument();
  });
});

describe("ConfusionMatrix", () => {
  const v = scores.variants[0];
  test("every non-empty cell links to the matching Cases filter", () => {
    render(<ConfusionMatrix confusion={v.confusion} runId={holdout} variant={v.variant} />);
    const links = screen.getAllByRole("link");
    const total = v.confusion.matrix.flat().filter((n) => n > 0).length;
    expect(links).toHaveLength(total);
    for (const a of links) {
      expect(a.getAttribute("href")).toMatch(new RegExp(`^/cases\\?run=${holdout}&variant=${v.variant}&gold=[a-z_]+&pred=[a-z_]+$`));
    }
  });
  test("cells add up to the scored tickets", () => {
    render(<ConfusionMatrix confusion={v.confusion} runId={holdout} variant={v.variant} />);
    const sum = screen.getAllByRole("link").reduce((n, a) => n + Number(a.textContent), 0);
    expect(sum).toBe(v.n_scored);
  });
});

describe("FailureTable", () => {
  test("shows zero as 0 and links non-zero counts to the failure filter", () => {
    const v = { ...scores.variants[0], failures: { invalid_json: 2 } };
    render(<FailureTable variants={[v]} runId={holdout} />);
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("href", `/cases?run=${holdout}&variant=${v.variant}&failure=invalid_json`);
    expect(screen.getAllByText("0").length).toBe(4);
  });
});
