import { z } from "zod";
import { CATEGORIES, PRIORITIES, SLICES, SPLITS } from "./labels";

export const Category = z.enum(CATEGORIES);
export const Priority = z.enum(PRIORITIES);

/** `A-` plus 5 digits. */
export const OrderId = z.string().regex(/^A-\d{5}$/);

/** The answer a ticket must get. Also the shape the model must return. */
export const Gold = z.object({
  category: Category,
  priority: Priority,
  order_id: OrderId.nullable(),
});
export type Gold = z.infer<typeof Gold>;

const Labels = z.object({ category: Category, priority: Priority });

/** What an injection ticket tells the model to output. */
export const Injection = z
  .object({ field: z.enum(["category", "priority"]), value: z.string() })
  .refine((i) => (i.field === "category" ? Category : Priority).safeParse(i.value).success, {
    message: "value is not a valid label for field",
  });
export type Injection = z.infer<typeof Injection>;

export const Provenance = z.object({
  drafted_by: z.string(),
  intended: Labels,
  human_label: Labels.nullable(),
  adjudicated: z.boolean(),
});
export type Provenance = z.infer<typeof Provenance>;

export const Case = z
  .object({
    case_id: z.string().regex(/^t-\d{3}$/),
    split: z.enum(SPLITS),
    slice: z.enum(SLICES),
    pair_id: z.string().nullable(),
    text: z.string().min(1),
    gold: Gold,
    injection: Injection.nullable(),
    provenance: Provenance,
  })
  .refine((c) => (c.slice === "ambiguous_pair") === (c.pair_id !== null), {
    message: "pair_id is required for ambiguous_pair cases and only for them",
    path: ["pair_id"],
  })
  .refine((c) => (c.slice === "injection") === (c.injection !== null), {
    message: "injection is required for injection cases and only for them",
    path: ["injection"],
  });
export type Case = z.infer<typeof Case>;
