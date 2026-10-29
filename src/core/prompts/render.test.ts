import { describe, expect, test } from "vitest";
import { renderExamples, renderMessages } from "./render";

const gold = (category: string, order_id: string | null = null) => ({ category, priority: "high", order_id }) as never;
const cases = [
  { case_id: "t-020", split: "fewshot", text: "Second one", gold: gold("other") },
  { case_id: "t-010", split: "fewshot", text: "First one A-11111", gold: gold("billing_refund", "A-11111") },
  { case_id: "t-030", split: "tuning", text: "TUNING TEXT", gold: gold("product_bug") },
  { case_id: "t-040", split: "holdout", text: "HOLDOUT TEXT", gold: gold("product_bug") },
] as const;

const zero = {
  examples: "none" as const,
  messages: [
    { role: "system" as const, content: "Categories: {{categories}}. Priorities: {{priorities}}." },
    { role: "user" as const, content: "Ticket:\n{{ticket}}" },
  ],
};
const few = {
  examples: "fewshot" as const,
  messages: [zero.messages[0], { role: "user" as const, content: "{{examples}}\n\nTicket:\n{{ticket}}" }],
};

describe("renderMessages", () => {
  test("fills categories, priorities and ticket", () => {
    const [sys, user] = renderMessages(zero, { ticket: "Hello", cases: [] });
    expect(sys.content).toBe(
      "Categories: billing_refund, billing_dispute, account_access, account_security, shipping_delay, shipping_damaged, product_bug, feature_request, other. Priorities: low, normal, high, urgent.",
    );
    expect(user.content).toBe("Ticket:\nHello");
  });

  test("examples come only from the fewshot split, in case_id order, in a fixed format", () => {
    const text = renderMessages(few, { ticket: "X", cases })[1].content;
    expect(text).toBe(
      [
        'Example 1\nTicket:\nFirst one A-11111\nAnswer: {"category":"billing_refund","priority":"high","order_id":"A-11111"}',
        'Example 2\nTicket:\nSecond one\nAnswer: {"category":"other","priority":"high","order_id":null}',
        "Ticket:\nX",
      ].join("\n\n"),
    );
    expect(text).not.toContain("TUNING TEXT");
    expect(text).not.toContain("HOLDOUT TEXT");
  });

  test("a zero-shot prompt never shows examples even if cases are given", () => {
    const all = renderMessages(zero, { ticket: "X", cases }).map((m) => m.content).join("\n");
    expect(all).not.toContain("Example 1");
  });

  test("text inside the ticket is not expanded again", () => {
    const [, user] = renderMessages(zero, { ticket: "{{categories}} {{nope}}", cases: [] });
    expect(user.content).toBe("Ticket:\n{{categories}} {{nope}}");
  });

  test("bad prompts fail loudly", () => {
    expect(() => renderMessages({ ...zero, messages: [{ role: "user", content: "{{oops}} {{ticket}}" }] }, { ticket: "x", cases: [] })).toThrow(/unknown placeholder \{\{oops\}\}/);
    expect(() => renderMessages({ ...zero, messages: [{ role: "user", content: "no ticket here" }] }, { ticket: "x", cases: [] })).toThrow(/\{\{ticket\}\}/);
    expect(() => renderMessages(few, { ticket: "x", cases: [cases[2]] })).toThrow(/no fewshot cases/);
    expect(() => renderMessages({ ...few, messages: zero.messages }, { ticket: "x", cases })).toThrow(/\{\{examples\}\}/);
  });
});

test("renderExamples of nothing is empty", () => {
  expect(renderExamples([])).toBe("");
});
