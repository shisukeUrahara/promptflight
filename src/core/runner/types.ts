import { z } from "zod";
import { Category, Priority } from "../domain/case";
import { OutcomeCode } from "../domain/outcome";

/** One variant on one ticket. This is a row of per_case_results.jsonl. */
export const CaseResult = z.object({
  case_id: z.string(),
  variant: z.string(),
  variant_id: z.string(),
  /** null means the answer was valid. */
  code: OutcomeCode.nullable(),
  detail: z.string().nullable(),
  prediction: z.object({ category: Category, priority: Priority, order_id: z.string().nullable() }).nullable(),
  /** The raw answer, kept so every number can be traced to it. null when the call never answered. */
  raw: z.object({ content: z.string().nullable(), refusal: z.string().nullable(), finish_reason: z.string() }).nullable(),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).nullable(),
  latency_ms: z.number().nullable(),
  cached: z.boolean(),
});
export type CaseResult = z.infer<typeof CaseResult>;
