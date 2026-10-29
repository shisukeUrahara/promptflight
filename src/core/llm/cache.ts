import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { canonicalJson, sha256Hex } from "../prompts/canonical";
import { CacheMissError } from "./errors";
import type { LlmClient, LlmRequest, LlmResponse } from "./port";

/** Bump when the key recipe changes. Old entries then stop matching, visibly. */
const CACHE_V = 1;

export const CacheEntry = z.object({
  k: z.string(),
  content: z.string().nullable(),
  refusal: z.string().nullable(),
  finish_reason: z.string(),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }),
  latency_ms: z.number(),
  created_at: z.string(),
});
export type CacheEntry = z.infer<typeof CacheEntry>;

/** The key covers the whole request, response_format included: a changed schema is a visible miss. */
export const cacheKey = (req: LlmRequest): string => sha256Hex(canonicalJson({ cache_v: CACHE_V, request: req }));

export interface CacheOptions {
  /** Folder that holds one <model>.jsonl per model, e.g. <dataDir>/cache/responses. */
  dir: string;
  now?: () => Date;
}

/**
 * Wraps a client with an append-only response cache.
 * With inner = null it is replay mode: a miss throws CacheMissError and nothing is called.
 * Only answers that came back normally are stored. Errors throw before the write, so they never are.
 */
export class CachingLlm implements LlmClient {
  readonly stats = { hits: 0, misses: 0 };
  private maps = new Map<string, Map<string, CacheEntry>>();

  constructor(
    private inner: LlmClient | null,
    private opts: CacheOptions,
  ) {}

  private fileFor(model: string) {
    return path.join(this.opts.dir, `${model.replace(/[^A-Za-z0-9._-]/g, "_")}.jsonl`);
  }

  private mapFor(model: string): Map<string, CacheEntry> {
    let map = this.maps.get(model);
    if (map) return map;
    map = new Map();
    const file = this.fileFor(model);
    if (existsSync(file)) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (line.trim() === "") return;
          const parsed = CacheEntry.safeParse(safeJson(line));
          if (!parsed.success) throw new Error(`${file}:${i + 1}: not a cache entry`);
          map!.set(parsed.data.k, parsed.data);
        });
    }
    this.maps.set(model, map);
    return map;
  }

  /** Would this request be answered without a network call? */
  isCached(req: LlmRequest): boolean {
    return this.mapFor(req.model).has(cacheKey(req));
  }

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
    const k = cacheKey(req);
    const map = this.mapFor(req.model);
    const hit = map.get(k);
    if (hit) {
      this.stats.hits++;
      return { content: hit.content, refusal: hit.refusal, finish_reason: hit.finish_reason, usage: hit.usage, latency_ms: hit.latency_ms, cached: true };
    }
    if (!this.inner) throw new CacheMissError(k);

    this.stats.misses++;
    const res = await this.inner.complete(req, signal);
    if (!map.has(k)) {
      const entry: CacheEntry = {
        k,
        content: res.content,
        refusal: res.refusal,
        finish_reason: res.finish_reason,
        usage: res.usage,
        latency_ms: res.latency_ms,
        created_at: (this.opts.now?.() ?? new Date()).toISOString(),
      };
      mkdirSync(this.opts.dir, { recursive: true });
      // Sync on purpose: one thread, so parallel callers can never interleave a line.
      appendFileSync(this.fileFor(req.model), JSON.stringify(entry) + "\n");
      map.set(k, entry);
    }
    return { ...res, cached: false };
  }
}

function safeJson(line: string): unknown {
  try {
    return JSON.parse(line);
  } catch {
    return undefined;
  }
}
