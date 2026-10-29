import { ProviderError } from "./errors";
import type { LlmClient, LlmRequest, LlmResponse } from "./port";

export interface ResilientOptions {
  /** Wait before retry 1, retry 2, ... Its length is the number of retries. */
  backoffMs?: number[];
  timeoutMs?: number;
  /** Test hook. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Adds a timeout per call and bounded retries. Only 429, 5xx, timeout and network
 * errors are retried; anything else fails at once. After the last try the
 * ProviderError is thrown unchanged, so the runner can record its status.
 */
export class ResilientLlm implements LlmClient {
  private backoff: number[];
  private timeoutMs: number;
  private sleep: (ms: number) => Promise<void>;

  constructor(
    private inner: LlmClient,
    opts: ResilientOptions = {},
  ) {
    this.backoff = opts.backoffMs ?? [1000, 4000];
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    this.sleep = opts.sleep ?? realSleep;
  }

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.once(req, signal);
      } catch (e) {
        if (!(e instanceof ProviderError) || !e.retryable || attempt >= this.backoff.length) throw e;
        await this.sleep(this.backoff[attempt]);
      }
    }
  }

  private once(req: LlmRequest, outer?: AbortSignal): Promise<LlmResponse> {
    const ctl = new AbortController();
    outer?.addEventListener("abort", () => ctl.abort(), { once: true });
    let timer: ReturnType<typeof setTimeout>;
    // The race covers a client that ignores the abort signal.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctl.abort();
        reject(new ProviderError("timeout"));
      }, this.timeoutMs);
    });
    return Promise.race([this.inner.complete(req, ctl.signal), timeout]).finally(() => clearTimeout(timer));
  }
}
