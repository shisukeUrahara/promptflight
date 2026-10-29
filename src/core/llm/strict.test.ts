import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { renderMessages } from "../prompts/render";
import { resolveVersion } from "../prompts/version";
import { validateResponse } from "../validate/validate";
import { MAX_COMPLETION_TOKENS, MODEL_UNDER_TEST, PredictionSchema, buildRequest, strictResponseFormat } from "./strict";

const fixture = (name: string) => JSON.parse(readFileSync(`src/core/llm/__fixtures__/${name}.json`, "utf8"));
const answer = (name: string) => {
  const choice = fixture(name).choices[0];
  return { content: choice.message.content as string, refusal: choice.message.refusal, finish_reason: choice.finish_reason };
};

describe("strictResponseFormat", () => {
  const rf = strictResponseFormat() as { type: string; json_schema: { name: string; strict: boolean; schema: Record<string, unknown> } };
  const schema = rf.json_schema.schema as { type: string; properties: Record<string, Record<string, unknown>>; required: string[]; additionalProperties: boolean };

  test("is strict json_schema", () => {
    expect(rf.type).toBe("json_schema");
    expect(rf.json_schema).toMatchObject({ name: "ticket_label", strict: true });
  });

  test("lists every key as required, so order_id is nullable and not optional", () => {
    expect(schema.required).toEqual(["category", "priority", "order_id"]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.order_id.type).toEqual(["string", "null"]);
  });

  test("category and priority are closed enums", () => {
    expect(schema.properties.category.enum).toHaveLength(9);
    expect(schema.properties.priority.enum).toEqual(["low", "normal", "high", "urgent"]);
  });

  test("is plain data, so it survives JSON and makes a stable cache key", () => {
    expect(JSON.parse(JSON.stringify(rf))).toEqual(rf);
  });
});

describe("buildRequest", () => {
  const messages = [{ role: "user" as const, content: "hi" }];

  test("json_prompt sends no response_format", () => {
    const req = buildRequest("json_prompt", messages);
    expect(req).toEqual({ model: MODEL_UNDER_TEST, messages, temperature: 0, max_completion_tokens: MAX_COMPLETION_TOKENS });
    expect("response_format" in req).toBe(false);
  });

  test("json_strict adds only the response_format", () => {
    const { response_format, ...rest } = buildRequest("json_strict", messages);
    expect(rest).toEqual(buildRequest("json_prompt", messages));
    expect(response_format).toEqual(strictResponseFormat());
  });

  test("the zero-strict request is the zero-json request plus a response_format", () => {
    const render = (name: string) => renderMessages(resolveVersion(process.cwd(), name), { ticket: "T", cases: [] });
    const json = buildRequest("json_prompt", render("zero-json"));
    const strict = buildRequest("json_strict", render("zero-strict"));
    expect(strict.messages).toEqual(json.messages);
    expect(Object.keys(strict).filter((k) => !(k in json))).toEqual(["response_format"]);
  });
});

describe("recorded strict responses", () => {
  test("an answer with an order id parses and has only allowed labels", () => {
    const a = answer("chat_strict_order");
    expect(validateResponse(a)).toMatchObject({ ok: true, prediction: { category: "billing_dispute", order_id: "A-48213" } });
    expect(PredictionSchema.safeParse(JSON.parse(a.content)).success).toBe(true);
  });

  test("an answer with no order id has order_id null, and that is valid", () => {
    const a = answer("chat_strict_no_order");
    expect(JSON.parse(a.content).order_id).toBeNull();
    expect(validateResponse(a)).toMatchObject({ ok: true, prediction: { order_id: null } });
  });

  test("the schema rejects a missing order_id and a wrong label", () => {
    expect(PredictionSchema.safeParse({ category: "other", priority: "low" }).success).toBe(false);
    expect(PredictionSchema.safeParse({ category: "Billing", priority: "low", order_id: null }).success).toBe(false);
  });
});
