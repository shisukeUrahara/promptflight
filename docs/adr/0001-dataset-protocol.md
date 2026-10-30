# 0001 Dataset protocol: synthetic tickets, labeled blind

**Decision.** The test set is 204 synthetic support tickets. A seeded grid fixes each ticket's intended category, priority, slice, order id and split. gpt-4.1 writes one ticket per row. One person then labels every ticket from a sheet that never shows the intended label, and the human label is the gold label. Splits: 9 few-shot examples (never scored), 57 tuning, 138 holdout.

**Why.** Tickets with a known intent can cover the hard cases on purpose: ambiguous pairs, prompt injections, noisy text. Blind labeling turns "the drafter meant X" into a measured claim: category agreement 82.4% (Cohen's kappa 0.801), priority 52.0% (kappa 0.352). The drafts, the labels and a sha256 manifest are committed; `pf verify` fails CI on any changed byte.

**Changed after tuning.** Every variant scored above 0.95 on the first 45 tuning tickets, on two models. The plan's saturation rule applied: 60 harder tickets were added (30 misleading ambiguous, 15 persuasive injections, 15 two-issue), labeled blind, before any holdout run. The first 144 rows stayed byte-identical.

**Rejected.** The Bitext support dataset: templated and easy to saturate. Using the intended label as gold: the blind human label differs from it on 17.6% of categories.

**Limits.** One labeler. The drafter and one tested model are from the same family. Priority labels are noisy. The `other` class has 7 tickets.
