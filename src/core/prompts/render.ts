import type { Case } from "../domain/case";
import { CATEGORIES, PRIORITIES } from "../domain/labels";
import type { Msg } from "../llm/port";
import type { PromptVersion } from "./version";

export interface RenderInput {
  ticket: string;
  /** Any cases. Only the ones in the fewshot split are ever shown as examples. */
  cases: readonly Pick<Case, "case_id" | "split" | "text" | "gold">[];
}

/** One worked example. The format is fixed so prompts stay comparable. */
export function renderExample(n: number, c: Pick<Case, "text" | "gold">): string {
  const answer = JSON.stringify({ category: c.gold.category, priority: c.gold.priority, order_id: c.gold.order_id });
  return `Example ${n}\nTicket:\n${c.text}\nAnswer: ${answer}`;
}

export function renderExamples(cases: RenderInput["cases"]): string {
  return cases
    .filter((c) => c.split === "fewshot")
    .sort((a, b) => a.case_id.localeCompare(b.case_id))
    .map((c, i) => renderExample(i + 1, c))
    .join("\n\n");
}

/**
 * Fill {{categories}}, {{priorities}}, {{examples}} and {{ticket}}.
 * One pass, so a ticket that contains "{{categories}}" stays as typed.
 */
export function renderMessages(version: Pick<PromptVersion, "messages" | "examples">, input: RenderInput): Msg[] {
  const examples = version.examples === "fewshot" ? renderExamples(input.cases) : "";
  if (version.examples === "fewshot" && examples === "") throw new Error("few-shot prompt but no fewshot cases were given");
  const values: Record<string, string> = {
    categories: CATEGORIES.join(", "),
    priorities: PRIORITIES.join(", "),
    examples,
    ticket: input.ticket,
  };
  const uses = (name: string) => version.messages.some((m) => m.content.includes(`{{${name}}}`));
  if (version.examples === "fewshot" && !uses("examples")) throw new Error("few-shot prompt has no {{examples}} placeholder");
  if (!uses("ticket")) throw new Error("prompt has no {{ticket}} placeholder");

  return version.messages.map((m) => ({
    role: m.role,
    content: m.content.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
      if (!(name in values)) throw new Error(`unknown placeholder {{${name}}}`);
      return values[name];
    }),
  }));
}
