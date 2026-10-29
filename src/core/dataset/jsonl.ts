import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { z } from "zod";

export function readJsonl<S extends z.ZodType>(file: string, schema: S): z.infer<S>[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line, i) => {
      const parsed = schema.safeParse(JSON.parse(line));
      if (!parsed.success) throw new Error(`${file}:${i + 1}: ${parsed.error.message}`);
      return parsed.data;
    });
}

export function writeJsonl(file: string, rows: readonly object[]): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
}

/** Sync on purpose: one thread, so concurrent callers never interleave a line. */
export function appendJsonl(file: string, row: object): void {
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, JSON.stringify(row) + "\n");
}
