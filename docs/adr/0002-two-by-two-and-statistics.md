# 0002 A 2x2 design with pre-registered, paired tests

**Decision.** Four prompts: zero-shot or few-shot, crossed with the output format asked for in the prompt (json_prompt) or enforced by the API (json_strict). Each strict prompt has byte-identical text to its json twin; a test checks it. Every variant runs on the same tickets, so comparisons are paired: an exact McNemar test on the tickets where two variants disagree, with Holm correction over the four questions. Category accuracy is primary (H1-H4); priority accuracy is a second family (H5-H8). Bootstrap intervals resample ticket indices (10,000 draws, seeded), which also works for macro-F1.

**Why.** Paired tests use the fact that most tickets are easy for every variant; only the disagreements carry information. Pre-registering the four questions, the correction and the power statement (`docs/preregistration.md`, its commit SHA stored in each holdout manifest) keeps the result from being chosen after the fact.

**Findings that shaped the write-up.** `pf power` showed before the run that 138 tickets detect about a 13-point gap at 20% disagreement, and nothing at the 2-7% disagreement seen on tuning. The result was a pre-announced null on category, not a surprise. Priority was added as a second family before the holdout run, because tuning showed the variants differ there.

**Rejected.** Unpaired comparison of accuracies with overlapping intervals (throws away the pairing). A single "best prompt" ranking (hides that the differences are within noise).

**Limits.** One run per model at temperature 0; no repeat variance. Holm runs within each model and family, not across both models.
