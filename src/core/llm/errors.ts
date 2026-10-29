/** A call that did not finish: 429, 5xx or timeout. `status` is the HTTP code or "timeout". */
export class ProviderError extends Error {
  constructor(
    readonly status: number | "timeout",
    message = `provider error: ${status}`,
  ) {
    super(message);
    this.name = "ProviderError";
  }

  /** Worth another try. Other 4xx codes will fail the same way again. */
  get retryable(): boolean {
    return this.status === "timeout" || this.status === 429 || this.status >= 500;
  }
}

/** Replay mode asked for a call that is not in the cache. */
export class CacheMissError extends Error {
  constructor(readonly key: string) {
    super(`response not in cache (key ${key.slice(0, 12)})`);
    this.name = "CacheMissError";
  }
}
