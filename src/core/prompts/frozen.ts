import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { listVersions, PromptName } from "./version";

/** Which version of each variant is the one to run by default. */
export const Frozen = z.record(PromptName, z.string().regex(/^[0-9a-f]{8}$/));
export type Frozen = z.infer<typeof Frozen>;

const fileOf = (dataDir: string) => path.join(dataDir, "prompts", "frozen.json");

export function readFrozen(dataDir: string): Frozen {
  const file = fileOf(dataDir);
  return existsSync(file) ? Frozen.parse(JSON.parse(readFileSync(file, "utf8"))) : {};
}

export function writeFrozen(dataDir: string, frozen: Frozen): void {
  mkdirSync(path.dirname(fileOf(dataDir)), { recursive: true });
  writeFileSync(fileOf(dataDir), JSON.stringify(Frozen.parse(frozen), null, 2) + "\n");
}

/** One line per frozen id that is not a saved version of its variant. */
export function verifyFrozen(dataDir: string): string[] {
  return Object.entries(readFrozen(dataDir))
    .filter(([name, id]) => !listVersions(dataDir, name).some((v) => v.id === id))
    .map(([name, id]) => `frozen version not found: ${name} -> ${id}`);
}
