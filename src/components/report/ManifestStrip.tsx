import { CircleCheck, TriangleAlert } from "lucide-react";
import type { RunManifest } from "@/core/artifacts/manifest";

export function ManifestStrip({ m }: { m: RunManifest }) {
  const chip = "inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 font-mono text-xs";
  return (
    <ul aria-label="Run manifest" className="flex flex-wrap gap-2 text-muted">
      <li className={chip}>{m.model}</li>
      <li className={chip}>N={m.sample_count}</li>
      <li className={chip}>git {m.git_sha.slice(0, 8)}</li>
      <li className={chip}>
        {m.git_dirty ? <TriangleAlert className="size-3.5 text-warn" aria-hidden /> : <CircleCheck className="size-3.5 text-success" aria-hidden />}
        {m.git_dirty ? "uncommitted changes" : "clean tree"}
      </li>
      {m.preregistration_sha && <li className={chip}>pre-registered {m.preregistration_sha.slice(0, 8)}</li>}
      <li className={chip}>{m.replay ? "replayed from cache" : `${m.cache_misses} live calls`}</li>
      <li className={chip}>prices of {m.pricing_retrieved_at}</li>
    </ul>
  );
}
