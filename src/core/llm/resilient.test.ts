import { afterEach, describe, expect, test, vi } from "vitest";
import { FakeLlm, hang, http, ok } from "./fake";
import type { LlmRequest } from "./port";
import { ResilientLlm } from "./resilient";

const req: LlmRequest = { model: "m", messages: [{ role: "user", content: "hi" }], temperature: 0, max_completion_tokens: 200 };

function make(steps: ConstructorParameters<typeof FakeLlm>[0], extra: ConstructorParameters<typeof ResilientLlm>[1] = {}) {
  const sleeps: number[] = [];
  const inner = new FakeLlm(steps);
  const llm = new ResilientLlm(inner, { sleep: async (ms) => void sleeps.push(ms), ...extra });
  return { inner, llm, sleeps };
}

afterEach(() => vi.useRealTimers());

describe("ResilientLlm", () => {
  test("429, 429, 200 makes 3 calls and waits 1 s then 4 s", async () => {
    const { inner, llm, sleeps } = make([http(429), http(429), ok("fine")]);
    expect(await llm.complete(req)).toMatchObject({ content: "fine" });
    expect(inner.calls).toHaveLength(3);
    expect(sleeps).toEqual([1000, 4000]);
  });

  test("three 429s give up after 3 calls and throw the 429", async () => {
    const { inner, llm, sleeps } = make([http(429), http(429), http(429), ok("never")]);
    await expect(llm.complete(req)).rejects.toMatchObject({ status: 429 });
    expect(inner.calls).toHaveLength(3);
    expect(sleeps).toEqual([1000, 4000]);
  });

  test("a 5xx is retried; a 401 is not", async () => {
    const a = make([http(503), ok("fine")]);
    await a.llm.complete(req);
    expect(a.inner.calls).toHaveLength(2);

    const b = make([http(401), ok("never")]);
    await expect(b.llm.complete(req)).rejects.toMatchObject({ status: 401 });
    expect(b.inner.calls).toHaveLength(1);
    expect(b.sleeps).toEqual([]);
  });

  test("a call that never answers times out at 30 s, then is retried", async () => {
    vi.useFakeTimers();
    const { inner, llm, sleeps } = make([hang(), ok("second try")]);
    const pending = llm.complete(req);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(sleeps).toEqual([]); // not timed out yet
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ content: "second try" });
    expect(sleeps).toEqual([1000]);
    expect(inner.calls).toHaveLength(2);
  });

  test("three timeouts end as a timeout error", async () => {
    vi.useFakeTimers();
    const { llm } = make([hang(), hang(), hang()]);
    const pending = llm.complete(req).catch((e) => e);
    await vi.advanceTimersByTimeAsync(30_000 * 3);
    expect(await pending).toMatchObject({ status: "timeout" });
  });

  test("a client that ignores the abort signal is still cut off", async () => {
    vi.useFakeTimers();
    const stuck = { complete: () => new Promise<never>(() => {}) };
    const llm = new ResilientLlm(stuck, { backoffMs: [], timeoutMs: 100 });
    const pending = llm.complete(req).catch((e) => e);
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toMatchObject({ status: "timeout" });
  });
});
