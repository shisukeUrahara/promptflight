import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { validateResponse } from "./validate";

const stop = (content: string | null) => ({ content, refusal: null, finish_reason: "stop" });
const good = '{"category":"billing_dispute","priority":"high","order_id":"A-48213"}';

const code = (r: Parameters<typeof validateResponse>[0]) => {
  const v = validateResponse(r);
  return v.ok ? "ok" : v.code;
};

describe("validateResponse: one test per code", () => {
  test("a correct answer is accepted", () => {
    expect(validateResponse(stop(good))).toEqual({
      ok: true,
      prediction: { category: "billing_dispute", priority: "high", order_id: "A-48213" },
    });
    expect(code(stop('{"category":"other","priority":"low","order_id":null}'))).toBe("ok");
  });

  test("refusal", () => {
    expect(code({ content: null, refusal: "I can't help with that.", finish_reason: "stop" })).toBe("refusal");
  });

  test("truncated", () => {
    expect(code({ content: '{"category":"bill', refusal: null, finish_reason: "length" })).toBe("truncated");
  });

  test.each([
    ["prose", "Sure! The category is billing."],
    ["a markdown fence", "```json\n" + good + "\n```"],
    ["broken json", '{"category": "other",'],
    ["empty", ""],
    ["null content", null],
  ])("invalid_json: %s", (_name, content) => {
    expect(code(stop(content))).toBe("invalid_json");
  });

  test.each([
    ["an array", "[1,2]"],
    ["a string", '"billing"'],
    ["a number", "7"],
    ["null", "null"],
    ["a missing category", '{"priority":"low","order_id":null}'],
    ["a missing priority", '{"category":"other","order_id":null}'],
    ["a missing order_id", '{"category":"other","priority":"low"}'],
    ["a number as category", '{"category":3,"priority":"low","order_id":null}'],
    ["a number as order_id", '{"category":"other","priority":"low","order_id":48213}'],
  ])("schema_violation: %s", (_name, content) => {
    expect(code(stop(content))).toBe("schema_violation");
  });

  test.each([
    ["category", '{"category":"Billing","priority":"high","order_id":null}'],
    ["priority", '{"category":"other","priority":"High","order_id":null}'],
    ["case difference", '{"category":"OTHER","priority":"low","order_id":null}'],
  ])("invalid_label: %s", (_name, content) => {
    expect(code(stop(content))).toBe("invalid_label");
  });
});

describe("order of checks", () => {
  test("invalid_label is checked before anything could fold it into a shape error", () => {
    const v = validateResponse(stop('{"category":"Billing","priority":"High","order_id":"A-48213"}'));
    expect(v).toMatchObject({ ok: false, code: "invalid_label" });
  });

  test("a real recorded answer with made-up labels is invalid_label", () => {
    const body = JSON.parse(readFileSync("src/core/llm/__fixtures__/chat_ok.json", "utf8"));
    const choice = body.choices[0];
    const v = validateResponse({ content: choice.message.content, refusal: choice.message.refusal, finish_reason: choice.finish_reason });
    expect(v).toMatchObject({ ok: false, code: "invalid_label" });
  });

  test("a real recorded cut-off answer is truncated, even though its JSON is broken", () => {
    const body = JSON.parse(readFileSync("src/core/llm/__fixtures__/chat_length.json", "utf8"));
    const choice = body.choices[0];
    expect(validateResponse({ content: choice.message.content, refusal: null, finish_reason: choice.finish_reason })).toMatchObject({
      ok: false,
      code: "truncated",
    });
  });

  test("refusal wins over a valid body and over truncation", () => {
    expect(code({ content: good, refusal: "no", finish_reason: "length" })).toBe("refusal");
  });

  test("extra keys are ignored", () => {
    expect(code(stop('{"category":"other","priority":"low","order_id":null,"why":"because"}'))).toBe("ok");
  });
});
