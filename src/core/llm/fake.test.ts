import { describe, expect, test } from "vitest";
import { ProviderError } from "./errors";
import { FakeLlm, hang, http, ok, refusal, truncated } from "./fake";
import type { LlmRequest } from "./port";

const req: LlmRequest = {
  model: "m",
  messages: [{ role: "user", content: "hi" }],
  temperature: 0,
  max_completion_tokens: 200,
};

describe("FakeLlm", () => {
  test("returns scripted content and counts calls", async () => {
    const llm = new FakeLlm([ok("a"), ok("b")]);
    expect((await llm.complete(req)).content).toBe("a");
    expect((await llm.complete(req)).content).toBe("b");
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[0]).toBe(req);
  });

  test("scripts a refusal and a truncated answer", async () => {
    const llm = new FakeLlm([refusal("no"), truncated('{"cat')]);
    expect(await llm.complete(req)).toMatchObject({ content: null, refusal: "no" });
    expect(await llm.complete(req)).toMatchObject({ finish_reason: "length" });
  });

  test("scripts a 429, marked retryable", async () => {
    const llm = new FakeLlm([http(429)]);
    const err = await llm.complete(req).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.status).toBe(429);
    expect(err.retryable).toBe(true);
  });

  test("a hung call times out when aborted", async () => {
    const llm = new FakeLlm([hang()]);
    const ctl = new AbortController();
    const pending = llm.complete(req, ctl.signal);
    ctl.abort();
    await expect(pending).rejects.toMatchObject({ status: "timeout", retryable: true });
  });

  test("a function script can answer by request", async () => {
    const llm = new FakeLlm((r, n) => ok(`${r.model}-${n}`));
    expect((await llm.complete(req)).content).toBe("m-0");
  });

  test("running out of script is loud", async () => {
    await expect(new FakeLlm([]).complete(req)).rejects.toThrow(/ran out/);
  });
});

test("only 429, 5xx and timeout are retryable", () => {
  expect([400, 401, 404].some((s) => new ProviderError(s).retryable)).toBe(false);
  expect([429, 500, 503].every((s) => new ProviderError(s).retryable)).toBe(true);
});
