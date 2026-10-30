# 0003 Response cache and replay

**Decision.** Every model answer is stored in `cache/responses/<model>.jsonl`, append-only, keyed by sha256 of the canonical JSON of the whole request (model, messages, temperature, max tokens, response_format) plus a cache version. Only answers that came back are stored; errors never are. The cache and the run folders are committed. `--replay` answers from the cache only and stops at the first miss (exit 2, no run folder). `pf check-replay` re-runs every committed experiment from the cache in CI and fails if any answer differs.

**Why.** It makes every published number reproducible without an API key, and it records the latency of the original call, so replayed latency matches. Putting response_format in the key makes a changed schema a visible miss instead of a silently reused answer. A run also refuses to start when its estimated cost is above `--max-usd`; cached calls cost nothing.

**Findings.** 1,988 answers across 7 committed runs replay identically. One real run (gpt-4.1-nano, retired: every call 404) produced only provider errors; the runner now refuses to write a folder when every call failed.

**Rejected.** The Vercel AI SDK's `generateObject` and the OpenAI SDK's `.parse()`: both hide the raw invalid output, which is what PromptFlight measures. A database: 2,000 lines of JSON do not need one.

**Limits.** Temperature 0 is not fully deterministic upstream; replay reproduces the recorded answers, not a fresh call.
