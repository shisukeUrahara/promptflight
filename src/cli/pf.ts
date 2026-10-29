import { existsSync } from "node:fs";
import { loadEnv } from "@/core/env";
import { main } from "./main";

// Node built-in; does not override variables that are already set.
if (existsSync(".env")) process.loadEnvFile(".env");

main(process.argv.slice(2), {
  dataDir: loadEnv(process.env).dataDir,
  out: (line) => console.log(line),
  err: (line) => console.error(line),
}).then((code) => process.exit(code));
