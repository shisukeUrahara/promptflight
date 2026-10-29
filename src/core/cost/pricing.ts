import { readFileSync } from "node:fs";
import { z } from "zod";

export const Pricing = z.object({
  source_url: z.string().url(),
  retrieved_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
  models: z.record(z.string(), z.object({ input_per_1m: z.number().nonnegative(), output_per_1m: z.number().nonnegative() })),
});
export type Pricing = z.infer<typeof Pricing>;

export const loadPricing = (file: string): Pricing => Pricing.parse(JSON.parse(readFileSync(file, "utf8")));

function rates(pricing: Pricing, model: string) {
  const r = pricing.models[model];
  if (!r) throw new Error(`no price for model "${model}" in pricing.json`);
  return r;
}

/** Real cost from the token counts the API reported. */
export function actualUsd(pricing: Pricing, model: string, usage: { prompt_tokens: number; completion_tokens: number }): number {
  const r = rates(pricing, model);
  return (usage.prompt_tokens * r.input_per_1m + usage.completion_tokens * r.output_per_1m) / 1e6;
}

/**
 * Cost before any call. Input tokens are guessed as characters / 4; every call
 * is assumed to use its whole output budget. Callers pass cache misses only.
 */
export function estimateUsd(
  pricing: Pricing,
  model: string,
  calls: { inputChars: number; maxOutputTokens: number }[],
): number {
  const r = rates(pricing, model);
  const input = calls.reduce((n, c) => n + c.inputChars / 4, 0);
  const output = calls.reduce((n, c) => n + c.maxOutputTokens, 0);
  return (input * r.input_per_1m + output * r.output_per_1m) / 1e6;
}
