import { NoApiKeyError, type Deps } from "./deps";
import { EXIT } from "./exit";
import { applyReview } from "./commands/applyReview";
import { draftCases } from "./commands/draftCases";
import { reviewSheet } from "./commands/reviewSheet";
import { run } from "./commands/run";
import { specGrid } from "./commands/specGrid";
import { verify } from "./commands/verify";

type Command = (argv: string[], deps: Deps) => Promise<number>;

const COMMANDS: Record<string, Command> = {
  "spec-grid": specGrid,
  "draft-cases": draftCases,
  "review-sheet": reviewSheet,
  "apply-review": applyReview,
  run,
  verify,
};

export async function main(argv: string[], deps: Deps): Promise<number> {
  const [name, ...rest] = argv;
  const command = name === undefined ? undefined : COMMANDS[name];
  if (!command) {
    deps.err(`usage: pf <${Object.keys(COMMANDS).join("|")}> [options]`);
    return EXIT.USAGE;
  }
  try {
    return await command(rest, deps);
  } catch (e) {
    if (e instanceof NoApiKeyError) {
      deps.err(e.message);
      return EXIT.USAGE;
    }
    // parseArgs rejects unknown or malformed options with an ERR_PARSE_ARGS_* code.
    if (e instanceof Error && "code" in e && String(e.code).startsWith("ERR_PARSE_ARGS")) {
      deps.err(e.message);
      return EXIT.USAGE;
    }
    throw e;
  }
}
