import { CATEGORIES, PRIORITIES, type Category, type Priority } from "../domain/labels";
import type { MODEL_FAILURES } from "../domain/outcome";
import type { LlmResponse } from "../llm/port";

export type ModelFailure = (typeof MODEL_FAILURES)[number];

export interface Prediction {
  category: Category;
  priority: Priority;
  /** Any string or null. Whether it matches the gold id is a metric, not a validity rule. */
  order_id: string | null;
}

export type Verdict = { ok: true; prediction: Prediction } | { ok: false; code: ModelFailure; detail: string };

const fail = (code: ModelFailure, detail: string): Verdict => ({ ok: false, code, detail });

const isOneOf = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v);

/**
 * Turn one raw response into a prediction or exactly one failure code.
 * Checked in this order, first match wins:
 * refusal, truncated, invalid_json, schema_violation, invalid_label.
 * The label check runs by hand, before any Zod enum could swallow it,
 * so a wrong label stays separate from a wrong shape.
 * Output wrapped in a markdown fence is invalid_json on purpose: that is a contract break.
 */
export function validateResponse(res: Pick<LlmResponse, "content" | "refusal" | "finish_reason">): Verdict {
  if (res.refusal) return fail("refusal", res.refusal);
  if (res.finish_reason === "length") return fail("truncated", "stopped at max_completion_tokens");

  let parsed: unknown;
  try {
    if (res.content === null || res.content.trim() === "") throw new Error("empty output");
    parsed = JSON.parse(res.content);
  } catch (e) {
    return fail("invalid_json", e instanceof Error ? e.message : String(e));
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return fail("schema_violation", "output is not a JSON object");
  }
  const o = parsed as Record<string, unknown>;
  if (typeof o.category !== "string") return fail("schema_violation", "category is missing or not a string");
  if (typeof o.priority !== "string") return fail("schema_violation", "priority is missing or not a string");
  if (!("order_id" in o) || (o.order_id !== null && typeof o.order_id !== "string")) {
    return fail("schema_violation", "order_id is missing or not a string or null");
  }

  if (!isOneOf(CATEGORIES, o.category)) return fail("invalid_label", `category "${o.category}" is not allowed`);
  if (!isOneOf(PRIORITIES, o.priority)) return fail("invalid_label", `priority "${o.priority}" is not allowed`);

  return { ok: true, prediction: { category: o.category, priority: o.priority, order_id: o.order_id as string | null } };
}
