import { ProviderError } from "./errors";
import type { LlmClient, LlmRequest, LlmResponse } from "./port";

export type Step = LlmResponse | Error | { hang: true };

const usage = { prompt_tokens: 100, completion_tokens: 20 };

/** A normal answer. */
export const ok = (content: string, over: Partial<LlmResponse> = {}): LlmResponse => ({
  content,
  refusal: null,
  finish_reason: "stop",
  usage,
  latency_ms: 50,
  cached: false,
  ...over,
});
export const refusal = (text: string): LlmResponse => ok("", { content: null, refusal: text });
export const truncated = (partial: string): LlmResponse => ok(partial, { finish_reason: "length" });
export const http = (status: number): ProviderError => new ProviderError(status);
/** Never answers. Rejects with a timeout when the caller aborts. */
export const hang = (): { hang: true } => ({ hang: true });

/**
 * Scripted client for tests. `script` is a list of steps used in order, or a
 * function that picks a step from the request and the call number (from 0).
 */
export class FakeLlm implements LlmClient {
  readonly calls: LlmRequest[] = [];

  constructor(private script: Step[] | ((req: LlmRequest, n: number) => Step)) {}

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
    const n = this.calls.length;
    this.calls.push(req);
    const step = typeof this.script === "function" ? this.script(req, n) : this.script[n];
    if (step === undefined) throw new Error(`FakeLlm script ran out at call ${n}`);
    if (step instanceof Error) throw step;
    if ("hang" in step) {
      return new Promise((_, reject) => {
        const timeout = () => reject(new ProviderError("timeout"));
        if (signal?.aborted) timeout();
        else signal?.addEventListener("abort", timeout, { once: true });
      });
    }
    return step;
  }
}
