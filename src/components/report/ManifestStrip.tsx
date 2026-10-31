import type { RunManifest } from "@/core/artifacts/manifest";
import { Pill } from "../ui/Pill";

/** The facts that make a run trustworthy, as status pills. */
export function ManifestStrip({ m }: { m: RunManifest }) {
  return (
    <ul aria-label="Run manifest" className="flex flex-wrap gap-2">
      <li>
        <Pill tone={m.git_dirty ? "warn" : "success"} dot>
          {m.git_dirty ? "uncommitted changes" : "clean tree"}
        </Pill>
      </li>
      {m.preregistration_sha && (
        <li>
          <Pill tone="brand" mono>
            pre-registered {m.preregistration_sha.slice(0, 8)}
          </Pill>
        </li>
      )}
      <li>
        <Pill mono>{m.model}</Pill>
      </li>
      <li>
        <Pill mono>N={m.sample_count}</Pill>
      </li>
      <li>
        <Pill mono>git {m.git_sha.slice(0, 8)}</Pill>
      </li>
      <li>
        <Pill mono>{m.replay ? "replayed from cache" : `${m.cache_misses} live calls`}</Pill>
      </li>
      <li>
        <Pill mono>prices of {m.pricing_retrieved_at}</Pill>
      </li>
    </ul>
  );
}
