import type { Case } from "../domain/case";
import { CATEGORIES } from "../domain/labels";

/**
 * The 27-case seed set: per category, the fewshot case plus the first 2 tuning
 * cases by case_id. The fewshot cases are never scored, so 18 seed cases are.
 */
export function seedIds(cases: readonly Pick<Case, "case_id" | "split" | "gold">[]): Set<string> {
  const ids = new Set<string>();
  for (const category of CATEGORIES) {
    const own = cases.filter((c) => c.gold.category === category);
    own.filter((c) => c.split === "fewshot").forEach((c) => ids.add(c.case_id));
    own
      .filter((c) => c.split === "tuning")
      .sort((a, b) => a.case_id.localeCompare(b.case_id))
      .slice(0, 2)
      .forEach((c) => ids.add(c.case_id));
  }
  return ids;
}
