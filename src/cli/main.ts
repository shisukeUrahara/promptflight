import type { Deps } from "./deps";
import { EXIT } from "./exit";
import { specGrid } from "./commands/specGrid";

type Command = (argv: string[], deps: Deps) => Promise<number>;

const COMMANDS: Record<string, Command> = {
  "spec-grid": specGrid,
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
    // parseArgs rejects unknown or malformed options with an ERR_PARSE_ARGS_* code.
    if (e instanceof Error && "code" in e && String(e.code).startsWith("ERR_PARSE_ARGS")) {
      deps.err(e.message);
      return EXIT.USAGE;
    }
    throw e;
  }
}
