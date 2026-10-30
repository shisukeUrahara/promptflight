import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { listVersions, resolveVersion, saveVersion } from "@/core/prompts/version";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const { restorePrompt, savePrompt } = await import("./actions");

let dir: string;
const messages = [
  { role: "system" as const, content: "Classify. {{categories}}" },
  { role: "user" as const, content: "Ticket:\n{{ticket}}" },
];
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "pf-actions-"));
  process.env.PF_DATA_DIR = dir;
  delete process.env.PF_READONLY;
  saveVersion(dir, { name: "zero-json", messages, output_mode: "json_prompt", examples: "none", created_at: "2026-10-30T10:00:00Z" });
});
afterEach(() => {
  delete process.env.PF_DATA_DIR;
  delete process.env.PF_READONLY;
});

const edit = (content: string) => ({ name: "zero-json", messages: [messages[0], { role: "user", content }], output_mode: "json_prompt", examples: "none" });

describe("savePrompt", () => {
  test("saves an edit as a new version whose parent is the previous newest", async () => {
    const first = resolveVersion(dir, "zero-json").id;
    const r = await savePrompt(edit("New ticket:\n{{ticket}}"));
    expect(r).toMatchObject({ ok: true, restored: false });
    expect(resolveVersion(dir, "zero-json")).toMatchObject({ id: r.ok ? r.id : "", parent: first });
  });

  test("PF_READONLY=1 refuses and writes nothing", async () => {
    process.env.PF_READONLY = "1";
    expect(await savePrompt(edit("x {{ticket}}"))).toEqual({ ok: false, error: expect.stringContaining("PF_READONLY") });
    expect(listVersions(dir, "zero-json")).toHaveLength(1);
  });

  test("rejects input that is not a prompt, and a prompt that could not run", async () => {
    expect(await savePrompt({ name: "../etc", messages: [] })).toMatchObject({ ok: false });
    expect(await savePrompt(edit("no ticket placeholder"))).toMatchObject({ ok: false, error: expect.stringContaining("{{ticket}}") });
    expect(listVersions(dir, "zero-json")).toHaveLength(1);
  });
});

describe("restorePrompt", () => {
  test("puts an older version back on top with the previous newest as parent", async () => {
    const first = resolveVersion(dir, "zero-json").id;
    const second = await savePrompt(edit("v2 {{ticket}}"));
    const r = await restorePrompt({ name: "zero-json", id: first });
    expect(r).toMatchObject({ ok: true, id: first, restored: true });
    expect(resolveVersion(dir, "zero-json")).toMatchObject({ id: first, parent: second.ok ? second.id : "" });
  });

  test("refuses in read-only mode and on a bad id", async () => {
    expect(await restorePrompt({ name: "zero-json", id: "nothex!!" })).toMatchObject({ ok: false });
    process.env.PF_READONLY = "1";
    expect(await restorePrompt({ name: "zero-json", id: resolveVersion(dir, "zero-json").id })).toMatchObject({ ok: false });
  });
});
