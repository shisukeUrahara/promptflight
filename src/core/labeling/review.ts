import type { Case } from "../domain/case";
import { CATEGORIES, PRIORITIES, type Category, type Priority } from "../domain/labels";
import type { SpecRow } from "../dataset/specGrid";
import { agreement, cohenKappa } from "./agreement";
import type { Draft } from "./draft";

export interface Labels {
  category: Category;
  priority: Priority;
}

const quote = (text: string) =>
  text
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");

/** The blind sheet: ticket text and two empty fields. No intended label appears. */
export function renderSheet(items: readonly { case_id: string; text: string }[]): string {
  const head = `# Case review

Read each ticket and fill in \`category:\` and \`priority:\` after the colon. Follow \`docs/labeling_guide.md\`.
Do not open \`fixtures/tickets/spec_grid.jsonl\` while you label. You can fill in the sheet in several sittings.

Categories: ${CATEGORIES.join(", ")}
Priorities: ${PRIORITIES.join(", ")}
`;
  const blocks = items.map((i) => `### ${i.case_id}\n\n${quote(i.text)}\n\ncategory: \npriority: \n`);
  return [head, ...blocks].join("\n");
}

export interface ParsedSheet {
  /** Fields the human filled in. A blank field is left out. */
  labels: Map<string, { category?: string; priority?: string }>;
}

const blocksOf = (md: string) => md.split(/^### (?=t-\d{3}\s*$)/m).slice(1);
const field = (block: string, name: string) => block.match(new RegExp(`^${name}:[ \\t]*(\\S*)[ \\t]*$`, "m"))?.[1] || undefined;

export function parseSheet(md: string): ParsedSheet {
  const labels: ParsedSheet["labels"] = new Map();
  for (const block of blocksOf(md)) {
    const id = block.match(/^(t-\d{3})/)![1];
    labels.set(id, { category: field(block, "category"), priority: field(block, "priority") });
  }
  return { labels };
}

export interface Final {
  category?: string;
  priority?: string;
}

/** Read the owner's `final category:` / `final priority:` answers back from the disagreements file. */
export function parseFinals(md: string): Map<string, Final> {
  const finals = new Map<string, Final>();
  for (const block of blocksOf(md)) {
    const id = block.match(/^(t-\d{3})/)![1];
    finals.set(id, { category: field(block, "final category"), priority: field(block, "final priority") });
  }
  return finals;
}

export interface Disagreement {
  case_id: string;
  text: string;
  intended: Labels;
  human: Labels;
}

export function renderDisagreements(items: readonly Disagreement[], finals: ReadonlyMap<string, Final>): string {
  const head = `# Disagreements

The human label differs from the label the drafter was asked to write for. For each ticket, choose the label that is right by \`docs/labeling_guide.md\`.
Write it after \`final category:\` or \`final priority:\`. Then run \`pnpm pf apply-review\` again.
Until you do, the human label is used and the ticket counts as not adjudicated.
`;
  const blocks = items.map((d) => {
    const lines = [`### ${d.case_id}`, "", quote(d.text), "", `intended: category=${d.intended.category} priority=${d.intended.priority}`, `human:    category=${d.human.category} priority=${d.human.priority}`];
    const f = finals.get(d.case_id);
    if (d.intended.category !== d.human.category) lines.push(`final category: ${f?.category ?? ""}`);
    if (d.intended.priority !== d.human.priority) lines.push(`final priority: ${f?.priority ?? ""}`);
    return lines.join("\n") + "\n";
  });
  return [head, ...blocks].join("\n");
}

export interface Stats {
  total: number;
  labeled: number;
  category: { agreement: number; kappa: number } | null;
  priority: { agreement: number; kappa: number } | null;
  disagreements: number;
  pending_adjudication: number;
}

export interface Built {
  cases: Case[];
  disagreements: Disagreement[];
  stats: Stats;
  /** Problems with the sheet or the answers. Empty when all is well. */
  errors: string[];
}

const isCategory = (v: string): v is Category => (CATEGORIES as readonly string[]).includes(v);
const isPriority = (v: string): v is Priority => (PRIORITIES as readonly string[]).includes(v);

/** Join spec, drafts, human labels and the owner's final answers into cases. Partly filled sheets are fine. */
export function buildCases(
  spec: readonly SpecRow[],
  drafts: readonly Draft[],
  sheet: ParsedSheet,
  finals: ReadonlyMap<string, Final>,
): Built {
  const draftOf = new Map(drafts.map((d) => [d.case_id, d]));
  const cases: Case[] = [];
  const disagreements: Disagreement[] = [];
  const errors: string[] = [];
  let pending = 0;
  const intendedCat: string[] = [];
  const humanCat: string[] = [];
  const intendedPri: string[] = [];
  const humanPri: string[] = [];

  for (const row of [...spec].sort((a, b) => a.case_id.localeCompare(b.case_id))) {
    const draft = draftOf.get(row.case_id);
    const given = sheet.labels.get(row.case_id);
    if (!draft || !given?.category || !given.priority) continue;
    if (!isCategory(given.category)) errors.push(`${row.case_id}: unknown category "${given.category}"`);
    if (!isPriority(given.priority)) errors.push(`${row.case_id}: unknown priority "${given.priority}"`);
    if (!isCategory(given.category) || !isPriority(given.priority)) continue;

    const human: Labels = { category: given.category, priority: given.priority };
    intendedCat.push(row.intended.category);
    humanCat.push(human.category);
    intendedPri.push(row.intended.priority);
    humanPri.push(human.priority);

    const gold: Labels = { ...human };
    const final = finals.get(row.case_id);
    const differs = human.category !== row.intended.category || human.priority !== row.intended.priority;
    let adjudicated = false;
    if (differs) {
      disagreements.push({ case_id: row.case_id, text: draft.text, intended: row.intended, human });
      const needCategory = human.category !== row.intended.category;
      const needPriority = human.priority !== row.intended.priority;
      const fc = final?.category;
      const fp = final?.priority;
      if (fc && !isCategory(fc)) errors.push(`${row.case_id}: unknown final category "${fc}"`);
      if (fp && !isPriority(fp)) errors.push(`${row.case_id}: unknown final priority "${fp}"`);
      if (fc && isCategory(fc)) gold.category = fc;
      if (fp && isPriority(fp)) gold.priority = fp;
      adjudicated = (!needCategory || !!fc) && (!needPriority || !!fp);
      if (!adjudicated) pending++;
    }

    cases.push({
      case_id: row.case_id,
      split: row.split,
      slice: row.slice,
      pair_id: row.pair_id,
      text: draft.text,
      gold: { ...gold, order_id: row.order_id },
      injection: row.injection,
      provenance: { drafted_by: draft.drafted_by, intended: row.intended, human_label: human, adjudicated },
      ...(row.batch ? { batch: row.batch } : {}),
    });
  }

  const has = cases.length > 0;
  return {
    cases,
    disagreements,
    errors,
    stats: {
      total: spec.length,
      labeled: cases.length,
      category: has ? { agreement: agreement(intendedCat, humanCat), kappa: cohenKappa(intendedCat, humanCat) } : null,
      priority: has ? { agreement: agreement(intendedPri, humanPri), kappa: cohenKappa(intendedPri, humanPri) } : null,
      disagreements: disagreements.length,
      pending_adjudication: pending,
    },
  };
}
