import OpenAI from "openai";
import { ProviderError } from "./errors";
import type { LlmClient, LlmRequest, LlmResponse } from "./port";

export interface OpenAiOptions {
  apiKey: string;
  /** Test hook: replaces the network. */
  fetch?: typeof fetch;
}

/**
 * Plain chat.completions.create, never .parse(): a bad answer must come back
 * as raw text so the validator can name what is wrong with it.
 * maxRetries is 0 because the runner owns retries.
 */
export class OpenAiClient implements LlmClient {
  private client: OpenAI;

  constructor(opts: OpenAiOptions) {
    this.client = new OpenAI({ apiKey: opts.apiKey, maxRetries: 0, fetch: opts.fetch });
  }

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<LlmResponse> {
    const started = performance.now();
    let res;
    try {
      res = await this.client.chat.completions.create(
        {
          model: req.model,
          messages: req.messages,
          temperature: req.temperature,
          max_completion_tokens: req.max_completion_tokens,
          ...(req.response_format ? { response_format: req.response_format as never } : {}),
        },
        { signal },
      );
    } catch (e) {
      throw toProviderError(e, signal);
    }
    const choice = res.choices[0];
    return {
      content: choice?.message.content ?? null,
      refusal: choice?.message.refusal ?? null,
      finish_reason: choice?.finish_reason ?? "unknown",
      usage: { prompt_tokens: res.usage?.prompt_tokens ?? 0, completion_tokens: res.usage?.completion_tokens ?? 0 },
      latency_ms: Math.round(performance.now() - started),
      cached: false,
    };
  }
}

function toProviderError(e: unknown, signal?: AbortSignal): ProviderError {
  if (signal?.aborted || e instanceof OpenAI.APIUserAbortError || e instanceof OpenAI.APIConnectionTimeoutError) {
    return new ProviderError("timeout");
  }
  if (e instanceof OpenAI.APIError && typeof e.status === "number") return new ProviderError(e.status, e.message);
  return new ProviderError("network", e instanceof Error ? e.message : String(e));
}
