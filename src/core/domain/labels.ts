export const CATEGORIES = [
  "billing_refund",
  "billing_dispute",
  "account_access",
  "account_security",
  "shipping_delay",
  "shipping_damaged",
  "product_bug",
  "feature_request",
  "other",
] as const;

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const SLICES = ["clear", "ambiguous_pair", "injection", "noisy"] as const;
export const SPLITS = ["fewshot", "tuning", "holdout"] as const;

export type Category = (typeof CATEGORIES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Slice = (typeof SLICES)[number];
export type Split = (typeof SPLITS)[number];
