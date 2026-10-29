import path from "node:path";
import { parseArgs } from "node:util";
import pLimit from "p-limit";
import { appendJsonl, readJsonl } from "@/core/dataset/jsonl";
import { SpecRow } from "@/core/dataset/specGrid";
import { estimateUsd, actualUsd, loadPricing } from "@/core/cost/pricing";
import { DRAFTER_MAX_TOKENS, DRAFTER_MODEL, DRAFTER_TEMPERATURE, Draft, draftMessages, rejectReason } from "@/core/labeling/draft";
import { ProviderError } from "@/core/llm/errors";
import type { Deps } from "../deps";
import { EXIT } from "../exit";

const CONCURRENCY = 4;

export async function draftCases(argv: string[], deps: Deps): Promise<number> {
  const { values } = parseArgs({ args: argv, options: { limit: { type: "string" }, "max-usd": { type: "string", default: "2" } } });
  const limit = values.limit === undefined ? Infinity : Number(values.limit);
  const maxUsd = Number(values["max-usd"]);
  if (!(limit >= 0) || !(maxUsd >= 0)) {
    deps.err("--limit and --max-usd must be non-negative numbers");
    return EXIT.USAGE;
  }

  const dir = path.join(deps.dataDir, "fixtures", "tickets");
  const grid = readJsonl(path.join(dir, "spec_grid.jsonl"), SpecRow);
  if (grid.length === 0) {
    deps.err("no spec_grid.jsonl. Run: pnpm pf spec-grid");
    return EXIT.USAGE;
  }
  const draftsFile = path.join(dir, "drafts.jsonl");
  const done = new Set(readJsonl(draftsFile, Draft).map((d) => d.case_id));
  const todo = grid.filter((r) => !done.has(r.case_id)).slice(0, limit);
  if (todo.length === 0) {
    deps.out(`nothing to draft (${done.size}/${grid.length} done)`);
    return EXIT.OK;
  }

  const pricing = loadPricing(deps.pricingFile);
  const estimate = estimateUsd(
    pricing,
    DRAFTER_MODEL,
    todo.map((r) => ({ inputChars: draftMessages(r).reduce((n, m) => n + m.content.length, 0), maxOutputTokens: DRAFTER_MAX_TOKENS })),
  );
  if (estimate > maxUsd) {
    deps.err(`estimated $${estimate.toFixed(4)} is above --max-usd ${maxUsd}. Nothing was called.`);
    return EXIT.COST_GATE;
  }

  const llm = deps.makeLlm();
  const limiter = pLimit(CONCURRENCY);
  let spent = 0;
  let written = 0;
  const problems: string[] = [];

  await Promise.all(
    todo.map((row) =>
      limiter(async () => {
        try {
          const res = await llm.complete({
            model: DRAFTER_MODEL,
            messages: draftMessages(row),
            temperature: DRAFTER_TEMPERATURE,
            max_completion_tokens: DRAFTER_MAX_TOKENS,
          });
          spent += actualUsd(pricing, DRAFTER_MODEL, res.usage);
          const text = (res.content ?? "").trim();
          const reason = rejectReason(row, text);
          if (reason) return void problems.push(`${row.case_id}: rejected (${reason})`);
          appendJsonl(draftsFile, { case_id: row.case_id, text, drafted_by: DRAFTER_MODEL, created_at: deps.now().toISOString() });
          written++;
        } catch (e) {
          if (!(e instanceof ProviderError)) throw e;
          problems.push(`${row.case_id}: provider error ${e.status}`);
        }
      }),
    ),
  );

  deps.out(`drafted ${written}/${todo.length}, spent $${spent.toFixed(4)} (estimate $${estimate.toFixed(4)})`);
  for (const p of problems) deps.err(p);
  if (problems.length > 0) {
    deps.err("Run the command again to retry the missing rows.");
    return EXIT.INFRA_FAILURES;
  }
  return EXIT.OK;
}
