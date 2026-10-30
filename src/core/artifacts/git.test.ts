import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { DirtyTreeError, PreregistrationError, guardRun } from "./guard";
import { NotAGitRepoError, repoState, type RepoState } from "./git";
import { RunManifest } from "./manifest";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.email=a@b", "-c", "user.name=t", "-C", cwd, ...args], { stdio: "ignore" });

/** A temp repo with one commit. */
function repo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "pf-git-"));
  git(dir, "init", "-q");
  writeFileSync(path.join(dir, "f.txt"), "one");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "init");
  return dir;
}
const commit = (dir: string, file: string, text: string) => {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
  writeFileSync(path.join(dir, file), text);
  git(dir, "add", ".");
  git(dir, "commit", "-qm", `edit ${file}`);
};

describe("repoState", () => {
  test("a clean repo has a 40-character sha and is not dirty", () => {
    const s = repoState(repo());
    expect(s.git_sha).toMatch(/^[0-9a-f]{40}$/);
    expect(s.git_dirty).toBe(false);
  });
  test("an edited tracked file makes it dirty", () => {
    const dir = repo();
    writeFileSync(path.join(dir, "f.txt"), "two");
    expect(repoState(dir).git_dirty).toBe(true);
  });
  test("an untracked file makes it dirty too", () => {
    const dir = repo();
    writeFileSync(path.join(dir, "new.txt"), "x");
    expect(repoState(dir).git_dirty).toBe(true);
  });
  test("outside a git checkout it throws instead of reporting clean", () => {
    expect(() => repoState(mkdtempSync(path.join(tmpdir(), "pf-nogit-")))).toThrow(NotAGitRepoError);
  });
  test("a repo with no commits throws", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "pf-empty-"));
    git(dir, "init", "-q");
    expect(() => repoState(dir)).toThrow(NotAGitRepoError);
  });
  test("preregistration_sha is null until the file is committed, then follows only that file", () => {
    const dir = repo();
    expect(repoState(dir).preregistration_sha).toBeNull();
    commit(dir, "docs/preregistration.md", "plan v1");
    const first = repoState(dir).preregistration_sha;
    expect(first).toMatch(/^[0-9a-f]{40}$/);
    commit(dir, "other.txt", "unrelated");
    expect(repoState(dir).preregistration_sha).toBe(first);
    commit(dir, "docs/preregistration.md", "plan v2");
    expect(repoState(dir).preregistration_sha).not.toBe(first);
  });
});

describe("guardRun", () => {
  const clean: RepoState = { git_sha: "a".repeat(40), git_dirty: false, preregistration_sha: "b".repeat(40) };

  test("a clean tree with a committed pre-registration may run holdout", () => {
    expect(() => guardRun("holdout", clean, false)).not.toThrow();
  });
  test("a dirty tree is refused for holdout, unless --allow-dirty", () => {
    expect(() => guardRun("holdout", { ...clean, git_dirty: true }, false)).toThrow(DirtyTreeError);
    expect(() => guardRun("holdout", { ...clean, git_dirty: true }, true)).not.toThrow();
  });
  test("no committed pre-registration is refused even with --allow-dirty", () => {
    expect(() => guardRun("holdout", { ...clean, preregistration_sha: null }, true)).toThrow(PreregistrationError);
  });
  test("tuning is never blocked", () => {
    expect(() => guardRun("tuning", { ...clean, git_dirty: true, preregistration_sha: null }, false)).not.toThrow();
  });
});

describe("RunManifest", () => {
  const valid = {
    run_id: "20261031T101500Z-holdout",
    label: "Holdout set · 4 variants · 31 Oct 2026 10:15 UTC",
    created_at_utc: "2026-10-31T10:15:00.000Z",
    split: "holdout",
    sample_count: 90,
    model: "gpt-4.1-mini-2025-04-14",
    variants: { "zero-json": "024ed5a3" },
    temperature: 0,
    max_completion_tokens: 200,
    dataset_sha256: "c".repeat(64),
    pricing_retrieved_at: "2026-10-29",
    preregistration_sha: "b".repeat(40),
    git_sha: "a".repeat(40),
    git_dirty: false,
    allow_dirty: false,
    replay: false,
    cache_hits: 0,
    cache_misses: 360,
    infra_failures: 0,
  };
  test("accepts a full manifest", () => {
    expect(RunManifest.safeParse(valid).success).toBe(true);
  });
  test.each([
    ["a missing git_sha", { ...valid, git_sha: undefined }],
    ["a short sha", { ...valid, git_sha: "abc" }],
    ["the fewshot split", { ...valid, split: "fewshot" }],
    ["a negative count", { ...valid, infra_failures: -1 }],
  ])("rejects %s", (_n, input) => {
    expect(RunManifest.safeParse(input).success).toBe(false);
  });
});
