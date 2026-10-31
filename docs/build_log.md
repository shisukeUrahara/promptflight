# Build log

Short notes on what happened while building, in order. Spend is from the response cache and the drafting output.

- **29 Oct.** Repo, CI, the core lint boundary. Spec grid of 144 tickets. OpenAI client tested against recorded responses. A bare prompt with no label list answered `{"category": "Billing", ...}`: the reason `invalid_label` is its own failure code.
- **29 Oct.** Drafted 144 tickets with gpt-4.1. Bugs the data checks caught: 14 drafts rejected because the label `other` is also an English word; 11 of 18 injection tickets did not contain the words they were meant to inject. Both fixed and redrafted.
- **30 Oct.** All 144 labeled blind. Category agreement with the drafter 84.0% (kappa 0.820); priority 51.4% (kappa 0.343).
- **30 Oct.** First tuning runs: every variant 0.91 to 0.98 on two models. The saturation rule applied. `gpt-4.1-nano` turned out to be retired (all 180 calls returned 404); the runner now refuses to write a run when every call failed.
- **30 Oct.** 60 harder tickets drafted ($0.063) and labeled blind. A difficulty probe scored against the drafter's intent looked hard (10-11 of 12); against the human labels it was not (11-12 of 12).
- **30 Oct.** Priority added as a second family, pre-registration committed (`ec38d6bb`), one holdout run per model. No contrast shown after Holm. Injections obeyed on 5 to 11 of 20 tickets.
- **30 Oct.** UI designed in Stitch and built. The accessibility sweep found red-on-red badge text at 4.0:1; the token was darkened to 5.2:1.
- **31 Oct.** UI redesign v2 ("Afterglow"): designed in Stitch in light and dark, then built. New Overview home page; scores moved to /results; ticket search; phone bottom tabs. A unit test now checks every text colour pair is at least 4.5:1; it caught the dark primary button at 4.35:1. A table inside a grid cell made the phone layout 516 px wide; e2e now checks the page is never wider than the screen.
- **31 Oct.** Docker check with no API key: `docker compose up --build`, the four pages return 200, an unknown page 404, and saving a prompt in the browser writes a new version file.
- **31 Oct.** Fresh clone with no key: `pnpm pf check-replay` replays every run from the cache; both holdout `scores.json` files are byte-identical to the committed ones, so the redesign did not touch a result.

Total API spend: about $0.60 (model calls in the cache $0.38, drafting the rest).
