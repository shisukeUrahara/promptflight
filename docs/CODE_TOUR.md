# Code tour

Read in this order. Everything under `src/core/` is plain TypeScript with no Next.js or React; a lint rule enforces it (`eslint.config.mjs`, tested in `src/core/boundary.test.ts`).

## 1. The data
- `src/core/domain/labels.ts`, `src/core/domain/case.ts`: the 9 categories, 4 priorities, and the Zod schema of a ticket.
- `src/core/dataset/specGrid.ts`, `src/core/dataset/hardGrid.ts`: the seeded grid of intended labels (144 + 60).
- `src/core/labeling/draft.ts`: the drafter prompt and the checks that reject a bad draft.
- `src/core/labeling/review.ts`, `src/core/labeling/agreement.ts`: the blind review sheet, applying human labels, Cohen's kappa.
- `src/core/dataset/manifest.ts`: sha256 manifest behind `pf verify`.

## 2. Prompts
- `src/core/prompts/version.ts`: immutable versions named by a hash of their content.
- `src/core/prompts/render.ts`: fills `{{categories}}`, `{{examples}}`, `{{ticket}}`; examples come only from the few-shot split.
- `src/core/prompts/edit.ts`: save and restore, used by the browser.
- `scripts/write-variant-prompts.ts`: how the four variants were written.

## 3. Calling the model
- `src/core/llm/port.ts`: the `LlmClient` interface. `src/core/llm/fake.ts` is the scripted fake every test uses.
- `src/core/llm/openai.ts`: `chat.completions.create`, never `.parse()`, so a bad answer stays visible.
- `src/core/llm/strict.ts`: the strict response format from Zod, and the request builder.
- `src/core/llm/resilient.ts`: timeout and retries. `src/core/llm/cache.ts`: the response cache and replay.

## 4. Running and scoring
- `src/core/validate/validate.ts`: one raw answer becomes a prediction or exactly one failure code.
- `src/core/runner/run.ts`, `src/core/runner/budget.ts`: four calls at a time, cost gate before the first call.
- `src/core/metrics/`: accuracy and F1, bootstrap, McNemar and Holm, power, per-variant summary.
- `src/core/artifacts/scores.ts`: the pre-registered contrasts. `src/core/artifacts/runFolder.ts`: what a run writes.
- `src/core/artifacts/git.ts`, `src/core/artifacts/guard.ts`: why a holdout run needs a clean tree and a committed pre-registration.

## 5. The command line
- `src/cli/main.ts` routes commands; each one is a file in `src/cli/commands/`. `src/cli/commands/run.ts` is the one that matters most.
- Every command takes a `Deps` object (`src/cli/deps.ts`), so tests pass fakes.

## 6. The web app
- `src/app/data.ts`: server-side reads of the data folder.
- `src/app/page.tsx` (Experiments), `src/app/cases/page.tsx`, `src/app/prompts/page.tsx`: server components.
- `src/app/prompts/actions.ts`: the only write path, a server action that checks read-only mode and validates input itself.
- `src/core/views/query.ts`, `src/core/views/cases.ts`: the Cases filters, kept in the URL.

## 7. Tests
- Unit and component tests sit next to the code (`*.test.ts` in node, `*.test.tsx` in jsdom; `vitest.config.ts`).
- Browser tests: `e2e/`, against `e2e/fixtures/data/`, a synthetic data folder built by `scripts/make-e2e-fixture.ts`.
