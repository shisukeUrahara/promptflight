import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { restoreVersion, saveEdit, validateEdit, type Edit } from "./edit";
import { listVersions, resolveVersion, verifyPrompts } from "./version";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "pf-edit-"));
});

const edit = (system: string, over: Partial<Edit> = {}): Edit => ({
  messages: [
    { role: "system", content: system },
    { role: "user", content: "Ticket:\n{{ticket}}" },
  ],
  output_mode: "json_prompt",
  examples: "none",
  ...over,
});
const t = (n: number) => new Date(Date.UTC(2026, 9, 30, 10, n));

describe("saveEdit", () => {
  test("the first save has no parent; the next edit points at the previous newest", () => {
    const v1 = saveEdit(dir, "p", edit("one"), t(0));
    const v2 = saveEdit(dir, "p", edit("two"), t(1));
    expect(v1).toMatchObject({ created: true, restored: false });
    const [a, b] = listVersions(dir, "p");
    expect([a.id, a.parent, b.id, b.parent]).toEqual([v1.id, null, v2.id, v1.id]);
    expect(resolveVersion(dir, "p").id).toBe(v2.id);
  });

  test("saving content that already exists restores it instead of duplicating", () => {
    const v1 = saveEdit(dir, "p", edit("one"), t(0));
    saveEdit(dir, "p", edit("two"), t(1));
    const again = saveEdit(dir, "p", edit("one"), t(2));
    expect(again).toMatchObject({ id: v1.id, restored: true, created: false });
    expect(listVersions(dir, "p")).toHaveLength(2);
  });

  test("an invalid prompt is refused and nothing is written", () => {
    expect(() => saveEdit(dir, "p", edit("hi {{nope}}"), t(0))).toThrow(/unknown placeholder/);
    expect(listVersions(dir, "p")).toEqual([]);
  });
});

describe("restoreVersion", () => {
  test("makes an older version the newest, with the previous newest as parent, and keeps its id", () => {
    const v1 = saveEdit(dir, "p", edit("one"), t(0));
    const v2 = saveEdit(dir, "p", edit("two"), t(1));
    const before = readFileSync(v1.file, "utf8");
    const r = restoreVersion(dir, "p", v1.id, t(5));
    expect(r).toMatchObject({ id: v1.id, restored: true });
    expect(resolveVersion(dir, "p")).toMatchObject({ id: v1.id, parent: v2.id, created_at: t(5).toISOString() });
    const after = JSON.parse(readFileSync(v1.file, "utf8"));
    expect(after.messages).toEqual(JSON.parse(before).messages); // content untouched
    expect(verifyPrompts(dir)).toEqual([]); // file name still equals content hash
  });

  test("restoring the newest version changes nothing", () => {
    const v1 = saveEdit(dir, "p", edit("one"), t(0));
    const before = readFileSync(v1.file, "utf8");
    expect(restoreVersion(dir, "p", v1.id, t(9))).toMatchObject({ restored: false });
    expect(readFileSync(v1.file, "utf8")).toBe(before);
  });

  test("a clock that runs behind still puts the restored version on top", () => {
    const v1 = saveEdit(dir, "p", edit("one"), t(10));
    saveEdit(dir, "p", edit("two"), t(20));
    restoreVersion(dir, "p", v1.id, t(0)); // earlier than the newest
    expect(resolveVersion(dir, "p").id).toBe(v1.id);
  });

  test("restoring twice walks back and forth", () => {
    const v1 = saveEdit(dir, "p", edit("one"), t(0));
    const v2 = saveEdit(dir, "p", edit("two"), t(1));
    restoreVersion(dir, "p", v1.id, t(2));
    restoreVersion(dir, "p", v2.id, t(3));
    expect(resolveVersion(dir, "p")).toMatchObject({ id: v2.id, parent: v1.id });
  });

  test("an id that belongs to another prompt, or to none, is refused", () => {
    saveEdit(dir, "p", edit("one"), t(0));
    const other = saveEdit(dir, "q", edit("other"), t(0));
    expect(() => restoreVersion(dir, "p", other.id, t(1))).toThrow(/no version/);
    expect(() => restoreVersion(dir, "p", "deadbeef", t(1))).toThrow(/no version/);
  });
});

describe("validateEdit", () => {
  test("accepts a runnable prompt, zero-shot and few-shot", () => {
    expect(() => validateEdit(edit("Labels: {{categories}} {{priorities}}"))).not.toThrow();
    expect(() => validateEdit({ ...edit("x"), examples: "fewshot", messages: [{ role: "user", content: "{{examples}}\n{{ticket}}" }] })).not.toThrow();
  });
  test.each([
    ["an unknown placeholder", edit("{{oops}}"), /unknown placeholder/],
    ["no {{ticket}}", { ...edit("x"), messages: [{ role: "user" as const, content: "nothing" }] }, /\{\{ticket\}\}/],
    ["few-shot without {{examples}}", edit("x", { examples: "fewshot" }), /\{\{examples\}\}/],
  ])("rejects %s", (_n, e, msg) => {
    expect(() => validateEdit(e)).toThrow(msg);
  });
});
