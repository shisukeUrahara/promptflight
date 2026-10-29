import { z } from "zod";

const Raw = z.object({
  OPENAI_API_KEY: z.string().trim().optional(),
  PF_READONLY: z.enum(["", "0", "1"]).optional(),
  PF_DATA_DIR: z.string().trim().optional(),
});

export interface Env {
  /** `live` may call the API. `replay` answers only from the cache. */
  mode: "live" | "replay";
  apiKey: string | null;
  readonly: boolean;
  dataDir: string;
}

/** Reads the three variables PromptFlight knows. A bad value throws and names it. */
export function loadEnv(source: Record<string, string | undefined>, cwd = process.cwd()): Env {
  const parsed = Raw.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`invalid environment variable: ${names}`);
  }
  const apiKey = parsed.data.OPENAI_API_KEY || null;
  return {
    mode: apiKey ? "live" : "replay",
    apiKey,
    readonly: parsed.data.PF_READONLY === "1",
    dataDir: parsed.data.PF_DATA_DIR || cwd,
  };
}
