import { writeFileSync } from "node:fs";
import path from "node:path";
import { renderMessages } from "./render";
import { listVersions, promptId, saveVersion, type PromptVersion, type Saved } from "./version";

export interface Edit {
  messages: PromptVersion["messages"];
  output_mode: PromptVersion["output_mode"];
  examples: PromptVersion["examples"];
}

/** Throws with a plain reason if the prompt could not be run: unknown placeholder, no {{ticket}}, few-shot without {{examples}}. */
export function validateEdit(edit: Edit): void {
  const dummy = { case_id: "t-000", split: "fewshot" as const, text: "example ticket", gold: { category: "other" as const, priority: "low" as const, order_id: null } };
  renderMessages(edit, { ticket: "ticket", cases: [dummy] });
}

export interface EditResult extends Saved {
  /** True when the content already existed and was only moved to the top of the history. */
  restored: boolean;
}

const newest = (dataDir: string, name: string) => listVersions(dataDir, name).at(-1);

/**
 * Make `id` the newest version of `name`.
 * A version's id is the hash of its content, so restoring cannot make a new file. It re-stamps
 * the existing one: created_at becomes now (never earlier than the current newest) and parent
 * becomes the version that was newest before. The content, and so the id, does not change.
 */
export function restoreVersion(dataDir: string, name: string, id: string, now: Date): EditResult {
  const versions = listVersions(dataDir, name);
  const target = versions.find((v) => v.id === id);
  if (!target) throw new Error(`"${name}" has no version ${id}`);
  const top = versions.at(-1)!;
  const file = path.join(dataDir, "prompts", name, `${id}.json`);
  if (top.id === id) return { id, file, created: false, restored: false };

  const after = new Date(Math.max(now.getTime(), new Date(top.created_at).getTime() + 1));
  const { id: _id, ...fields } = target;
  void _id;
  writeFileSync(file, JSON.stringify({ ...fields, created_at: after.toISOString(), parent: top.id }, null, 2) + "\n");
  return { id, file, created: false, restored: true };
}

/**
 * Save an edited prompt as the newest version of `name`, with the previous newest as its parent.
 * If the same content was saved before, that version is restored instead of duplicated.
 */
export function saveEdit(dataDir: string, name: string, edit: Edit, now: Date): EditResult {
  validateEdit(edit);
  const top = newest(dataDir, name);
  const id = promptId(edit);
  if (top && listVersions(dataDir, name).some((v) => v.id === id)) return restoreVersion(dataDir, name, id, now);
  const saved = saveVersion(dataDir, { name, ...edit, created_at: now.toISOString(), parent: top?.id ?? null });
  return { ...saved, restored: false };
}
