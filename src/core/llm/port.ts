export interface Msg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  model: string;
  messages: Msg[];
  temperature: number;
  max_completion_tokens: number;
  response_format?: object;
}

export interface LlmResponse {
  content: string | null;
  refusal: string | null;
  finish_reason: string;
  usage: { prompt_tokens: number; completion_tokens: number };
  latency_ms: number;
  cached: boolean;
}

export interface LlmClient {
  complete(req: LlmRequest, signal?: AbortSignal): Promise<LlmResponse>;
}
