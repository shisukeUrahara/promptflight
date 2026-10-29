import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { CATEGORIES, PRIORITIES } from "../domain/labels";
import type { LlmRequest, Msg } from "./port";

export const MODEL_UNDER_TEST = "gpt-4.1-mini-2025-04-14";
export const TEMPERATURE = 0;
export const MAX_COMPLETION_TOKENS = 200;

/** The answer contract. order_id is nullable, never optional: strict mode needs every key present. */
export const PredictionSchema = z.object({
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  order_id: z.string().nullable(),
});

/** Plain JSON: no helper functions ride along into the cache key or the request body. */
export function strictResponseFormat(): object {
  return JSON.parse(JSON.stringify(zodResponseFormat(PredictionSchema, "ticket_label")));
}

export type OutputMode = "json_prompt" | "json_strict";

/** The request for one ticket. Only json_strict adds a response_format. */
export function buildRequest(outputMode: OutputMode, messages: Msg[], model = MODEL_UNDER_TEST): LlmRequest {
  return {
    model,
    messages,
    temperature: TEMPERATURE,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    ...(outputMode === "json_strict" ? { response_format: strictResponseFormat() } : {}),
  };
}
