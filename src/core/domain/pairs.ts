import type { Category } from "./labels";

/** Category pairs that tickets can blur. Each has a rule in docs/labeling_guide.md. */
export const AMBIGUOUS_PAIRS = [
  { id: "refund-vs-dispute", categories: ["billing_refund", "billing_dispute"] },
  { id: "access-vs-security", categories: ["account_access", "account_security"] },
  { id: "delay-vs-damaged", categories: ["shipping_delay", "shipping_damaged"] },
  { id: "bug-vs-feature", categories: ["product_bug", "feature_request"] },
  { id: "other-vs-feature", categories: ["other", "feature_request"] },
] as const;

export type PairId = (typeof AMBIGUOUS_PAIRS)[number]["id"];

/** The pair behind each of a category's 4 ambiguous tickets. */
export const PAIRS_PER_CATEGORY: Record<Category, readonly PairId[]> = {
  billing_refund: ["refund-vs-dispute", "refund-vs-dispute", "refund-vs-dispute", "refund-vs-dispute"],
  billing_dispute: ["refund-vs-dispute", "refund-vs-dispute", "refund-vs-dispute", "refund-vs-dispute"],
  account_access: ["access-vs-security", "access-vs-security", "access-vs-security", "access-vs-security"],
  account_security: ["access-vs-security", "access-vs-security", "access-vs-security", "access-vs-security"],
  shipping_delay: ["delay-vs-damaged", "delay-vs-damaged", "delay-vs-damaged", "delay-vs-damaged"],
  shipping_damaged: ["delay-vs-damaged", "delay-vs-damaged", "delay-vs-damaged", "delay-vs-damaged"],
  product_bug: ["bug-vs-feature", "bug-vs-feature", "bug-vs-feature", "bug-vs-feature"],
  feature_request: ["bug-vs-feature", "bug-vs-feature", "other-vs-feature", "other-vs-feature"],
  other: ["other-vs-feature", "other-vs-feature", "other-vs-feature", "other-vs-feature"],
};
