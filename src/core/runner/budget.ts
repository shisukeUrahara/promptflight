import { estimateUsd, type Pricing } from "../cost/pricing";
import type { LlmRequest } from "../llm/port";

export class CostGateError extends Error {
  constructor(
    readonly estimate: number,
    readonly maxUsd: number,
  ) {
    super(`estimated $${estimate.toFixed(4)} is above the limit of $${maxUsd}. No call was made.`);
    this.name = "CostGateError";
  }
}

export interface Budget {
  pricing: Pricing;
  maxUsd: number;
  /** Requests the cache already holds cost nothing and are left out. */
  isCached?: (req: LlmRequest) => boolean;
}

/** Throws before any call if the calls still to be paid for would cost more than maxUsd. */
export function checkBudget(requests: readonly LlmRequest[], budget: Budget): number {
  const total = requests
    .filter((r) => !budget.isCached?.(r))
    .reduce(
      (sum, r) =>
        sum +
        estimateUsd(budget.pricing, r.model, [
          { inputChars: r.messages.reduce((n, m) => n + m.content.length, 0), maxOutputTokens: r.max_completion_tokens },
        ]),
      0,
    );
  if (total > budget.maxUsd) throw new CostGateError(total, budget.maxUsd);
  return total;
}
