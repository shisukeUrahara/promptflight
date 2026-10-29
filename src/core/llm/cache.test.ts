import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { CachingLlm, cacheKey } from "./cache";
import { CacheMissError } from "./errors";
import { FakeLlm, http, ok, refusal, truncated } from "./fake";
import type { LlmRequest } from "./port";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "pf-cache-"));
});

const req = (text = "hi", extra: Partial<LlmRequest> = {}): LlmRequest => ({
  model: "gpt-test-1",
  messages: [{ role: "user", content: text }],
  temperature: 0,
  max_completion_tokens: 200,
  ...extra,
});
const lines = (model = "gpt-test-1") => readFileSync(path.join(dir, `${model}.jsonl`), "utf8").trim().split("\n");

describe("CachingLlm", () => {
  test("a miss calls through, a hit replays with the recorded latency and cached: true", async () => {
    const inner = new FakeLlm([ok("answer", { latency_ms: 77 })]);
    const llm = new CachingLlm(inner, { dir });
    const first = await llm.complete(req());
    expect(first).toMatchObject({ content: "answer", cached: false, latency_ms: 77 });
    const second = await llm.complete(req());
    expect(second).toMatchObject({ content: "answer", cached: true, latency_ms: 77 });
    expect(inner.calls).toHaveLength(1);
    expect(llm.stats).toEqual({ hits: 1, misses: 1 });
  });

  test("50 parallel misses write 50 whole lines", async () => {
    const llm = new CachingLlm(new FakeLlm((r) => ok(`for ${r.messages[0].content}`)), { dir });
    await Promise.all(Array.from({ length: 50 }, (_, i) => llm.complete(req(`ticket ${i}`))));
    const rows = lines().map((l) => JSON.parse(l));
    expect(rows).toHaveLength(50);
    expect(new Set(rows.map((r) => r.k)).size).toBe(50);
  });

  test("an error is not cached, and the next try goes through", async () => {
    const inner = new FakeLlm([http(429), ok("fine")]);
    const llm = new CachingLlm(inner, { dir });
    await expect(llm.complete(req())).rejects.toMatchObject({ status: 429 });
    expect(readdirSync(dir)).toEqual([]);
    expect(await llm.complete(req())).toMatchObject({ content: "fine", cached: false });
    expect(inner.calls).toHaveLength(2);
  });

  test("a refusal and a truncated answer are real answers and are cached", async () => {
    const inner = new FakeLlm([refusal("no"), truncated("{")]);
    const llm = new CachingLlm(inner, { dir });
    await llm.complete(req("a"));
    await llm.complete(req("b"));
    expect(await llm.complete(req("a"))).toMatchObject({ refusal: "no", cached: true });
    expect(await llm.complete(req("b"))).toMatchObject({ finish_reason: "length", cached: true });
    expect(inner.calls).toHaveLength(2);
  });

  test("the key covers response_format, so a changed schema is a miss", async () => {
    const inner = new FakeLlm([ok("a"), ok("b")]);
    const llm = new CachingLlm(inner, { dir });
    await llm.complete(req("x", { response_format: { type: "json_schema", v: 1 } }));
    await llm.complete(req("x", { response_format: { type: "json_schema", v: 2 } }));
    expect(inner.calls).toHaveLength(2);
    expect(lines()).toHaveLength(2);
  });

  test("the key ignores the order of keys in the request", () => {
    const a = req("x", { response_format: { a: 1, b: 2 } });
    const b = { response_format: { b: 2, a: 1 }, max_completion_tokens: 200, temperature: 0, messages: a.messages, model: a.model };
    expect(cacheKey(a)).toBe(cacheKey(b));
  });

  test("replay mode: a hit works after a restart, a miss throws and calls nothing", async () => {
    await new CachingLlm(new FakeLlm([ok("saved")]), { dir }).complete(req());
    const replay = new CachingLlm(null, { dir });
    expect(await replay.complete(req())).toMatchObject({ content: "saved", cached: true });
    await expect(replay.complete(req("never seen"))).rejects.toBeInstanceOf(CacheMissError);
  });

  test("isCached tells hits from misses without calling anything", async () => {
    const llm = new CachingLlm(new FakeLlm([ok("x")]), { dir });
    expect(llm.isCached(req())).toBe(false);
    await llm.complete(req());
    expect(llm.isCached(req())).toBe(true);
  });

  test("each model gets its own file", async () => {
    const llm = new CachingLlm(new FakeLlm([ok("a"), ok("b")]), { dir });
    await llm.complete(req("x", { model: "gpt-a" }));
    await llm.complete(req("x", { model: "gpt-b" }));
    expect(readdirSync(dir).sort()).toEqual(["gpt-a.jsonl", "gpt-b.jsonl"]);
  });

  test("a damaged line is reported with its file and line number", async () => {
    writeFileSync(path.join(dir, "gpt-test-1.jsonl"), "not json\n");
    await expect(new CachingLlm(null, { dir }).complete(req())).rejects.toThrow(/gpt-test-1\.jsonl:1/);
  });
});
