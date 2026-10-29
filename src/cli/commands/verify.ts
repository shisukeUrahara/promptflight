import path from "node:path";
import { verifyManifest } from "@/core/dataset/manifest";
import { verifyFrozen } from "@/core/prompts/frozen";
import { verifyPrompts } from "@/core/prompts/version";
import type { Deps } from "../deps";
import { EXIT } from "../exit";

export async function verify(_argv: string[], deps: Deps): Promise<number> {
  const problems = [...verifyManifest(path.join(deps.dataDir, "fixtures", "tickets")), ...verifyPrompts(deps.dataDir), ...verifyFrozen(deps.dataDir)];
  if (problems.length > 0) {
    problems.forEach((p) => deps.err(p));
    return EXIT.GATE_FAILED;
  }
  deps.out("dataset and prompt files check out");
  return EXIT.OK;
}
