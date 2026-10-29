import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { OpenAiClient } from "./openai";
import type { LlmRequest } from "./port";

const fixture = (name: string) => readFileSync(`src/core/llm/__fixtures__/${name}.json`, "utf8");
const json = (body: string, status = 200) => new Response(body, { status, headers: { "content-type": "application/json" } });

const req: LlmRequest = {
  model: "gpt-4.1-mini-2025-04-14",
  messages: [{ role: "user", content: "hi" }],
  temperature: 0,
  max_completion_tokens: 200,
};

function client(respond: (init: RequestInit) => Response | Promise<Response>) {
  const calls: RequestInit[] = [];
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    calls.push(init ?? {});
    return respond(init ?? {});
  }) as typeof fetch;
  return { llm: new OpenAiClient({ apiKey: "sk-test", fetch: fetchImpl }), calls };
}

describe("OpenAiClient", () => {
  test("maps a recorded 200 response", async () => {
    const { llm, calls } = client(() => json(fixture("chat_ok")));
    const res = await llm.complete(req);
    expect(res).toMatchObject({
      content: '{"category": "Billing", "priority": "High", "order_id": "A-48213"}',
      refusal: null,
      finish_reason: "stop",
      usage: { prompt_tokens: 55, completion_tokens: 22 },
      cached: false,
    });
    expect(res.latency_ms).toBeGreaterThanOrEqual(0);
    const sent = JSON.parse(String(calls[0].body));
    expect(sent).toMatchObject({ model: req.model, temperature: 0, max_completion_tokens: 200 });
    expect(sent.response_format).toBeUndefined();
  });

  test("keeps finish_reason length", async () => {
    const { llm } = client(() => json(fixture("chat_length")));
    expect((await llm.complete(req)).finish_reason).toBe("length");
  });

  test("sends response_format when given", async () => {
    const { llm, calls } = client(() => json(fixture("chat_ok")));
    await llm.complete({ ...req, response_format: { type: "json_object" } });
    expect(JSON.parse(String(calls[0].body)).response_format).toEqual({ type: "json_object" });
  });

  test("maps a refusal", async () => {
    const body = JSON.parse(fixture("chat_ok"));
    body.choices[0].message = { role: "assistant", content: null, refusal: "I cannot help." };
    const { llm } = client(() => json(JSON.stringify(body)));
    expect(await llm.complete(req)).toMatchObject({ content: null, refusal: "I cannot help." });
  });

  test.each([429, 500, 503])("maps HTTP %i to ProviderError with no hidden retry", async (status) => {
    const { llm, calls } = client(() => json(JSON.stringify({ error: { message: "nope" } }), status));
    await expect(llm.complete(req)).rejects.toMatchObject({ name: "ProviderError", status });
    expect(calls).toHaveLength(1);
  });

  test("maps a 401 to a non-retryable error", async () => {
    const { llm } = client(() => json(JSON.stringify({ error: { message: "bad key" } }), 401));
    await expect(llm.complete(req)).rejects.toMatchObject({ status: 401, retryable: false });
  });

  test("maps an abort to timeout", async () => {
    const { llm } = client(
      (init) =>
        new Promise<Response>((_, reject) =>
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))),
        ),
    );
    const ctl = new AbortController();
    const pending = llm.complete(req, ctl.signal);
    ctl.abort();
    await expect(pending).rejects.toMatchObject({ status: "timeout" });
  });

  test("maps a dropped connection to network", async () => {
    const { llm } = client(() => {
      throw new TypeError("fetch failed");
    });
    await expect(llm.complete(req)).rejects.toMatchObject({ status: "network", retryable: true });
  });
});
