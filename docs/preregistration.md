# Pre-registration: holdout run

Written and committed on 30 Oct 2026, before any holdout ticket was sent to any model.
The holdout run records the git SHA of the last commit that touched this file (`preregistration_sha` in its manifest).

## Question
For support-ticket classification, how much do few-shot examples and API-enforced structured output change accuracy, on the same tickets?

## What is frozen
- **Prompts** (`prompts/frozen.json`): zero-json `024ed5a3`, zero-strict `8ff38b4e`, few-json `8bce780b`, few-strict `4224b7c2`. Each strict prompt has byte-identical text to its json twin; only `response_format` differs. The prompts were not revised after tuning, because tuning left almost no room (see below).
- **Models:** `gpt-4.1-mini-2025-04-14` (primary) and `gpt-4o-mini-2024-07-18` (replication). Temperature 0, at most 200 output tokens. `gpt-4.1-nano` was planned as the smaller model but is retired (HTTP 404).
- **Holdout:** 138 tickets: 90 from the first batch and 48 from the hard batch. 51 ambiguous, 45 clear, 21 noisy or two-issue, 21 prompt injection.
- **Gold labels:** one human labeler, blind to the intended label. Agreement with the drafter's intended label over all 204 tickets: category 82.4% (Cohen's kappa 0.801), priority 52.0% (kappa 0.352). The human label is the gold label.

## Hypotheses and tests
Each model is run once. Each family is corrected with Holm over its four tests, alpha 0.05, two-sided exact McNemar on the tickets both variants answered.

| ID | Family | Comparison (treatment vs baseline) | Question |
|---|---|---|---|
| H1 | category (primary) | few-json vs zero-json | Does few-shot help without strict output? |
| H2 | category (primary) | zero-strict vs zero-json | Does strict output help without few-shot? |
| H3 | category (primary) | few-strict vs zero-strict | Does few-shot help with strict output? |
| H4 | category (primary) | few-strict vs few-json | Does strict output help with few-shot? |
| H5 | priority (secondary) | few-json vs zero-json | Same as H1, on priority |
| H6 | priority (secondary) | zero-strict vs zero-json | Same as H2, on priority |
| H7 | priority (secondary) | few-strict vs zero-strict | Same as H3, on priority |
| H8 | priority (secondary) | few-strict vs few-json | Same as H4, on priority |

A claim that a technique "helps" or "hurts" is made only when its Holm-adjusted p is below 0.05. Every other difference is reported as "not shown".

Reported without tests: accuracy and macro-F1 with 95% bootstrap intervals (10,000 draws, seed 20261029), format validity, label validity, injection success rate, order-id exact match, tokens, latency p50/p95, cost per 100 tickets.

## Power, stated before the run
`pnpm pf power --n 138` (20% of tickets differ between variants, alpha 0.0125, power 0.8): smallest detectable accuracy difference = **0.13**.

The 20% is an assumption. On the 57 tuning tickets the variants differed far less:
- category: 1 to 4 tickets per comparison (2 to 7%) on both models. At 5% (`--discordant 0.05`) no difference up to 0.05 is detectable. **The category family (H1 to H4) is expected to show no significant result.** Both models already score 0.93 to 0.98 on tuning.
- priority: up to 16 of 57 tickets (28%) on gpt-4o-mini. At 30% the detectable difference is 0.16. The priority family is the one with a real chance of a result.

## What changed after looking at tuning (all before this file)
1. Every variant scored above 0.95 on the first 45 tuning tickets, on both models. Following the plan's saturation rule, 60 harder tickets were drafted and labeled blind (12 tuning, 48 holdout).
2. Against the human labels, the hard tuning tickets were not hard for the models (11 or 12 of 12 right).
3. The priority family (H5 to H8) was added because priority is where the variants differed on tuning.

## Run rules
- One holdout run per model, from a clean, committed tree. If any call fails after retries, the failed calls are retried once more; if any still fail, no scores are written.
- Infrastructure failures are not scored. Model failures (bad JSON, wrong shape, label outside the list, refusal, truncation) count as wrong.
- The holdout responses are cached and committed; `pnpm pf check-replay` must reproduce every answer without an API key.

## Known limits
LLM-written tickets; the ticket writer (gpt-4.1) and one tested model are from the same family; one labeler; priority labels are noisy (kappa 0.352); the `other` class has 7 tickets in all.
