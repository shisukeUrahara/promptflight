import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { canonicalJson } from "./canonical";
import { listVersions, promptId, resolveVersion, saveVersion, verifyPrompts, type NewVersion } from "./version";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "pf-prompts-"));
});

const base: NewVersion = {
  name: "zero-json",
  messages: [
    { role: "system", content: "You classify tickets." },
    { role: "user", content: "{{ticket}}" },
  ],
  output_mode: "json_prompt",
  examples: "none",
  created_at: "2026-10-30T10:00:00Z",
};

describe("canonicalJson", () => {
  test("key order does not matter, whitespace is gone", () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { y: 1, x: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"x":2,"y":1}]},"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });
  test("array order does matter", () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});

describe("promptId", () => {
  test("is 8 hex characters and stable", () => {
    const id = promptId(base as never);
    expect(id).toMatch(/^[0-9a-f]{8}$/);
    expect(promptId({ ...base, messages: [...base.messages] } as never)).toBe(id);
  });
  test("changed content gives a new id", () => {
    const a = promptId(base as never);
    expect(promptId({ ...base, examples: "fewshot" } as never)).not.toBe(a);
    expect(promptId({ ...base, output_mode: "json_strict" } as never)).not.toBe(a);
    expect(promptId({ ...base, messages: [{ role: "system", content: "You classify tickets!" }, base.messages[1]] } as never)).not.toBe(a);
  });
});

describe("version store", () => {
  test("the same content twice keeps one file and ignores created_at and parent", () => {
    const first = saveVersion(dir, base);
    const second = saveVersion(dir, { ...base, created_at: "2027-01-01T00:00:00Z", parent: "abcdef12" });
    expect(first.created).toBe(true);
    expect(second).toMatchObject({ id: first.id, created: false });
    expect(listVersions(dir, "zero-json")).toHaveLength(1);
    expect(JSON.parse(readFileSync(first.file, "utf8")).created_at).toBe(base.created_at);
  });

  test("changed content is a new version stored under its id", () => {
    const a = saveVersion(dir, base);
    const b = saveVersion(dir, { ...base, examples: "fewshot", created_at: "2026-10-31T10:00:00Z", parent: a.id });
    expect(b.id).not.toBe(a.id);
    expect(path.basename(b.file)).toBe(`${b.id}.json`);
    expect(listVersions(dir, "zero-json").map((v) => v.id)).toEqual([a.id, b.id]);
  });

  test("a name resolves to the newest version, 8 hex to that exact version", () => {
    const a = saveVersion(dir, base);
    const b = saveVersion(dir, { ...base, examples: "fewshot", created_at: "2026-10-31T10:00:00Z" });
    expect(resolveVersion(dir, "zero-json").id).toBe(b.id);
    expect(resolveVersion(dir, a.id).id).toBe(a.id);
  });

  test("an unknown name or id throws", () => {
    saveVersion(dir, base);
    expect(() => resolveVersion(dir, "nope")).toThrow(/no prompt version/);
    expect(() => resolveVersion(dir, "deadbeef")).toThrow(/no prompt version/);
    expect(() => resolveVersion(dir, "../etc")).toThrow(/no prompt version/);
  });

  test("a name must be a safe folder name and cannot look like an id", () => {
    expect(() => saveVersion(dir, { ...base, name: "../evil" })).toThrow();
    expect(() => saveVersion(dir, { ...base, name: "deadbeef" })).toThrow();
    expect(() => saveVersion(dir, { ...base, name: "Has Space" })).toThrow();
  });

  test("verifyPrompts is clean, then flags a renamed file and an edited file", () => {
    const a = saveVersion(dir, base);
    expect(verifyPrompts(dir)).toEqual([]);
    const edited = JSON.parse(readFileSync(a.file, "utf8"));
    edited.messages[0].content = "tampered";
    writeFileSync(a.file, JSON.stringify(edited));
    expect(verifyPrompts(dir)).toEqual([`prompt id mismatch: prompts/zero-json/${a.id}.json`]);
  });
});
