export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateOptions {
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  /** Per-request abort timeout (ms). Defaults to the provider's short-call budget. */
  timeoutMs?: number;
}

export interface GenerateResult {
  text: string;
  model: string;
}

export interface JsonResult<T> {
  data: T;
  model: string;
}
