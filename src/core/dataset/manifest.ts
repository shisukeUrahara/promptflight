import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

/** Files in fixtures/tickets/ whose bytes are pinned. */
export const TRACKED_FILES = ["spec_grid.jsonl", "drafts.jsonl", "cases.jsonl"] as const;
export const MANIFEST_NAME = "source_manifest.json";

export const Manifest = z.object({
  files: z.record(z.string(), z.object({ sha256: z.string(), bytes: z.number() })),
});
export type Manifest = z.infer<typeof Manifest>;

export const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");

/** Hash every tracked file that exists and write the manifest. */
export function writeManifest(dir: string): Manifest {
  const files: Manifest["files"] = {};
  for (const name of TRACKED_FILES) {
    const file = path.join(dir, name);
    if (!existsSync(file)) continue;
    const bytes = readFileSync(file);
    files[name] = { sha256: sha256(bytes), bytes: bytes.length };
  }
  const manifest = { files };
  writeFileSync(path.join(dir, MANIFEST_NAME), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

/** Returns one line per problem. An empty list means the files match the manifest. */
export function verifyManifest(dir: string): string[] {
  const manifestFile = path.join(dir, MANIFEST_NAME);
  if (!existsSync(manifestFile)) return [`missing: ${MANIFEST_NAME}`];
  const manifest = Manifest.parse(JSON.parse(readFileSync(manifestFile, "utf8")));
  const problems: string[] = [];
  for (const [name, expected] of Object.entries(manifest.files)) {
    const file = path.join(dir, name);
    if (!existsSync(file)) problems.push(`missing: ${name}`);
    else if (sha256(readFileSync(file)) !== expected.sha256) problems.push(`checksum mismatch: ${name}`);
  }
  for (const name of TRACKED_FILES) {
    if (existsSync(path.join(dir, name)) && !(name in manifest.files)) problems.push(`not in manifest: ${name}`);
  }
  return problems;
}
