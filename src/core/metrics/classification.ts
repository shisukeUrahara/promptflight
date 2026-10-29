import { CATEGORIES, type Category } from "../domain/labels";

/** One scored ticket. pred is null when the model failed to give a usable answer: that counts as wrong. */
export interface Scored {
  gold: Category;
  pred: Category | null;
}

export const accuracy = (items: readonly Scored[]): number =>
  items.length === 0 ? 0 : items.filter((i) => i.pred === i.gold).length / items.length;

export interface ClassStats {
  category: Category;
  /** How many tickets truly belong to this class. */
  support: number;
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

/**
 * Per-class precision, recall and F1 over all 9 categories.
 * F1 = 2tp / (2tp + fp + fn). A class nothing was predicted for, or with no support, scores 0.
 * A failed answer is a miss (fn) for its gold class and a hit (fp) for no class.
 */
export function perClass(items: readonly Scored[]): ClassStats[] {
  return CATEGORIES.map((category) => {
    const tp = items.filter((i) => i.gold === category && i.pred === category).length;
    const fp = items.filter((i) => i.gold !== category && i.pred === category).length;
    const fn = items.filter((i) => i.gold === category && i.pred !== category).length;
    return {
      category,
      support: tp + fn,
      tp,
      fp,
      fn,
      precision: ratio(tp, tp + fp),
      recall: ratio(tp, tp + fn),
      f1: ratio(2 * tp, 2 * tp + fp + fn),
    };
  });
}

/** Mean F1 over all 9 classes, so an empty class pulls the score down. */
export const macroF1 = (items: readonly Scored[]): number => {
  const stats = perClass(items);
  return stats.reduce((sum, s) => sum + s.f1, 0) / stats.length;
};

export interface Confusion {
  /** Row labels: the gold category. */
  rows: readonly Category[];
  /** Column labels: the 9 categories, then "failed". */
  columns: readonly (Category | "failed")[];
  /** matrix[row][column] */
  matrix: number[][];
}

export function confusion(items: readonly Scored[]): Confusion {
  const columns = [...CATEGORIES, "failed"] as const;
  const matrix = CATEGORIES.map(() => columns.map(() => 0));
  for (const i of items) matrix[CATEGORIES.indexOf(i.gold)][columns.indexOf(i.pred ?? "failed")]++;
  return { rows: CATEGORIES, columns, matrix };
}
