import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "@/core/env";
import { OpenAiClient } from "@/core/llm/openai";
import { NoApiKeyError } from "./deps";
import { main } from "./main";

// Node built-in; does not override variables that are already set.
if (existsSync(".env")) process.loadEnvFile(".env");
const env = loadEnv(process.env);

main(process.argv.slice(2), {
  dataDir: env.dataDir,
  pricingFile: path.join(process.cwd(), "pricing.json"),
  makeLlm: () => {
    if (!env.apiKey) throw new NoApiKeyError();
    return new OpenAiClient({ apiKey: env.apiKey });
  },
  now: () => new Date(),
  out: (line) => console.log(line),
  err: (line) => console.error(line),
}).then((code) => process.exit(code));
