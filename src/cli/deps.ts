import type { RepoState } from "@/core/artifacts/git";
import type { LlmClient } from "@/core/llm/port";

/** Everything a command touches outside its own arguments. Tests pass fakes. */
export interface Deps {
  /** Folder that holds fixtures/ prompts/ cache/ experiments/. */
  dataDir: string;
  /** pricing.json lives with the code, not with the data. */
  pricingFile: string;
  /** Builds the live client. Throws NoApiKeyError when there is no key. */
  makeLlm(): LlmClient;
  now(): Date;
  /** Wait before each retry of a failed call. Tests shorten it. Default 1 s then 4 s. */
  retryBackoffMs?: number[];
  /** Git state of the code checkout (not of dataDir). Throws NotAGitRepoError outside one. */
  repoState(): RepoState;
  out(line: string): void;
  err(line: string): void;
}

export class NoApiKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not set. Put it in .env to make live calls.");
    this.name = "NoApiKeyError";
  }
}
