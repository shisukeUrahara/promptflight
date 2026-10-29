/** A call that did not finish. `status` is the HTTP code, "timeout", or "network" (no HTTP answer). */
export class ProviderError extends Error {
  constructor(
    readonly status: number | "timeout" | "network",
    message = `provider error: ${status}`,
  ) {
    super(message);
    this.name = "ProviderError";
  }

  /** Worth another try. Other 4xx codes will fail the same way again. */
  get retryable(): boolean {
    return typeof this.status === "string" || this.status === 429 || this.status >= 500;
  }
}

/** Replay mode asked for a call that is not in the cache. */
export class CacheMissError extends Error {
  constructor(readonly key: string) {
    super(`response not in cache (key ${key.slice(0, 12)})`);
    this.name = "CacheMissError";
  }
}
