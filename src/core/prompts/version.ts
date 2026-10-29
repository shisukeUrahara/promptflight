import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { canonicalJson, sha256Hex } from "./canonical";

const Id = z.string().regex(/^[0-9a-f]{8}$/);

/** A name is a folder, so it must be safe as one. It cannot look like an id. */
export const PromptName = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/)
  .refine((n) => !Id.safeParse(n).success, "a name cannot look like an 8-character id");

export const PromptVersion = z.object({
  name: PromptName,
  messages: z.array(z.object({ role: z.enum(["system", "user", "assistant"]), content: z.string() })).min(1),
  output_mode: z.enum(["json_prompt", "json_strict"]),
  examples: z.enum(["none", "fewshot"]),
  created_at: z.string(),
  parent: Id.nullable(),
});
export type PromptVersion = z.infer<typeof PromptVersion>;

/** First 8 hex of sha256 over the content that changes behavior. created_at, parent and name do not count. */
export function promptId(v: Pick<PromptVersion, "messages" | "output_mode" | "examples">): string {
  return sha256Hex(canonicalJson({ messages: v.messages, output_mode: v.output_mode, examples: v.examples })).slice(0, 8);
}

const dirOf = (dataDir: string, name: string) => path.join(dataDir, "prompts", PromptName.parse(name));

export interface Saved {
  id: string;
  file: string;
  /** False when this exact content was already saved. The old file is kept. */
  created: boolean;
}

export type NewVersion = Omit<PromptVersion, "parent"> & { parent?: string | null };

export function saveVersion(dataDir: string, input: NewVersion): Saved {
  const v = PromptVersion.parse({ parent: null, ...input });
  const id = promptId(v);
  const dir = dirOf(dataDir, v.name);
  const file = path.join(dir, `${id}.json`);
  if (existsSync(file)) return { id, file, created: false };
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(v, null, 2) + "\n");
  return { id, file, created: true };
}

export interface Stored extends PromptVersion {
  id: string;
}

export function readVersion(file: string): Stored {
  const v = PromptVersion.parse(JSON.parse(readFileSync(file, "utf8")));
  return { ...v, id: path.basename(file, ".json") };
}

/** All versions of a name, oldest first. */
export function listVersions(dataDir: string, name: string): Stored[] {
  const dir = dirOf(dataDir, name);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readVersion(path.join(dir, f)))
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

export function listNames(dataDir: string): string[] {
  const dir = path.join(dataDir, "prompts");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** A name gives its newest version. An 8-character id gives that exact version. Anything else throws. */
export function resolveVersion(dataDir: string, ref: string): Stored {
  if (PromptName.safeParse(ref).success) {
    const all = listVersions(dataDir, ref);
    if (all.length > 0) return all[all.length - 1];
  }
  if (Id.safeParse(ref).success) {
    for (const name of listNames(dataDir)) {
      const file = path.join(dataDir, "prompts", name, `${ref}.json`);
      if (existsSync(file)) return readVersion(file);
    }
  }
  throw new Error(`no prompt version matches "${ref}"`);
}

/** One line per version whose file name is not its content hash, or whose folder is not its name. */
export function verifyPrompts(dataDir: string): string[] {
  const problems: string[] = [];
  for (const name of listNames(dataDir)) {
    const dir = path.join(dataDir, "prompts", name);
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const rel = `prompts/${name}/${f}`;
      let v: PromptVersion;
      try {
        v = PromptVersion.parse(JSON.parse(readFileSync(path.join(dir, f), "utf8")));
      } catch {
        problems.push(`invalid prompt file: ${rel}`);
        continue;
      }
      if (promptId(v) !== path.basename(f, ".json")) problems.push(`prompt id mismatch: ${rel}`);
      if (v.name !== name) problems.push(`prompt name mismatch: ${rel}`);
    }
  }
  return problems;
}
