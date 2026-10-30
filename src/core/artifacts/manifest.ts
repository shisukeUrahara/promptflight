import { z } from "zod";

/** Everything needed to say what produced a run. Written next to the results. */
export const RunManifest = z.object({
  run_id: z.string(),
  label: z.string(),
  created_at_utc: z.string(),
  split: z.enum(["tuning", "holdout"]),
  sample_count: z.number().int().nonnegative(),
  model: z.string(),
  variants: z.record(z.string(), z.string()),
  temperature: z.number(),
  max_completion_tokens: z.number().int(),
  dataset_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  pricing_retrieved_at: z.string(),
  preregistration_sha: z.string().nullable(),
  git_sha: z.string().regex(/^[0-9a-f]{40}$/),
  git_dirty: z.boolean(),
  allow_dirty: z.boolean(),
  replay: z.boolean(),
  cache_hits: z.number().int().nonnegative(),
  cache_misses: z.number().int().nonnegative(),
  infra_failures: z.number().int().nonnegative(),
});
export type RunManifest = z.infer<typeof RunManifest>;
