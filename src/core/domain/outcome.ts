import { z } from "zod";

/** The model answered, but wrongly. Scored as wrong. */
export const MODEL_FAILURES = ["invalid_json", "schema_violation", "invalid_label", "refusal", "truncated"] as const;

/** The call did not complete. Never scored. */
export const INFRA_FAILURES = ["provider_error", "provider_unavailable"] as const;

export const OutcomeCode = z.enum([...MODEL_FAILURES, ...INFRA_FAILURES]);
export type OutcomeCode = z.infer<typeof OutcomeCode>;

export const isInfraFailure = (code: OutcomeCode): boolean => (INFRA_FAILURES as readonly string[]).includes(code);
