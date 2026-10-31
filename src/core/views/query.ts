import { CATEGORIES, SLICES, SPLITS } from "../domain/labels";
import { OutcomeCode } from "../domain/outcome";

/** The filters of the Cases page, kept in the URL so every chart cell can link to a filtered list. */
export interface CasesQuery {
  run?: string;
  variant?: string;
  /** Gold category. */
  gold?: string;
  /** What the variant answered: a category, or "failed" for a model failure. Needs `variant`. */
  pred?: string;
  failure?: string;
  slice?: string;
  split?: string;
  /** Only tickets where the variants are not all right or all wrong together. */
  disagree?: boolean;
  /** Only tickets every variant got wrong. */
  allwrong?: boolean;
  /** Free text: matches the ticket id or its text, ignoring case. */
  q?: string;
}

const KEYS = ["run", "variant", "gold", "pred", "failure", "slice", "split", "q"] as const;

/** `/cases?run=...&variant=...`. Empty fields are left out; the key order is fixed. */
export function casesHref(q: CasesQuery): string {
  const params = new URLSearchParams();
  for (const k of KEYS) if (q[k]) params.set(k, q[k]);
  if (q.disagree) params.set("disagree", "1");
  if (q.allwrong) params.set("allwrong", "1");
  const s = params.toString();
  return s ? `/cases?${s}` : "/cases";
}

const SAFE_ID = /^[0-9A-Za-z_-]+$/;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Read a query from Next's searchParams. A value that is not valid is dropped, never an error:
 * someone may hand-edit the URL, and the page should still load.
 */
export function parseCasesQuery(raw: Record<string, string | string[] | undefined>): CasesQuery {
  const get = (k: string) => one(raw[k]);
  const pick = <T extends string>(k: string, allowed: readonly T[]): T | undefined => {
    const v = get(k);
    return allowed.includes(v as T) ? (v as T) : undefined;
  };
  const id = (k: string) => {
    const v = get(k);
    return v !== undefined && SAFE_ID.test(v) ? v : undefined;
  };
  const q: CasesQuery = {
    run: id("run"),
    variant: id("variant"),
    gold: pick("gold", CATEGORIES),
    pred: pick("pred", [...CATEGORIES, "failed"] as const),
    failure: pick("failure", OutcomeCode.options),
    slice: pick("slice", SLICES),
    split: pick("split", SPLITS),
    disagree: get("disagree") === "1" || undefined,
    allwrong: get("allwrong") === "1" || undefined,
    q: get("q")?.trim().slice(0, 100) || undefined,
  };
  return Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined)) as CasesQuery;
}
