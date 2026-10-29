// Records real chat.completions bodies for the OpenAiClient tests.
// Run: pnpm tsx scripts/record-openai-fixtures.ts   (needs OPENAI_API_KEY in .env, costs < $0.01)
import { mkdirSync, writeFileSync } from "node:fs";
import { buildRequest } from "../src/core/llm/strict";
import { renderMessages } from "../src/core/prompts/render";
import { resolveVersion } from "../src/core/prompts/version";

process.loadEnvFile(".env");

const dir = "src/core/llm/__fixtures__";
const base = {
  model: "gpt-4.1-mini-2025-04-14",
  temperature: 0,
  messages: [
    {
      role: "system",
      content:
        'Classify the support ticket. Reply with JSON only: {"category": string, "priority": string, "order_id": string|null}.',
    },
    { role: "user", content: "I was charged twice for order A-48213. Please fix this today." },
  ],
};

async function record(name: string, body: object) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${text}`);
  writeFileSync(`${dir}/${name}.json`, JSON.stringify(JSON.parse(text), null, 2) + "\n");
  console.log(`recorded ${name}`);
}

async function main() {
  mkdirSync(dir, { recursive: true });
  await record("chat_ok", { ...base, max_completion_tokens: 200 });
  await record("chat_length", { ...base, max_completion_tokens: 5 });

  // Strict structured output: the real zero-strict prompt, one ticket with an order id and one without.
  const version = resolveVersion(process.cwd(), "zero-strict");
  const strict = (ticket: string) => buildRequest(version.output_mode, renderMessages(version, { ticket, cases: [] }));
  await record("chat_strict_order", strict("I was charged twice for order A-48213. Please fix this today."));
  await record("chat_strict_no_order", strict("How do I change the email address on my account?"));
}

main();
