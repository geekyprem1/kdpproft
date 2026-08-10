/**
 * Provider orchestration: try the primary model, fall back to the next on error,
 * timeout, or schema-validation failure. All text generation goes through here.
 */

import { openRouterChat } from "./openrouter";
import { modelChain } from "./models";
import type { GenerateOptions, GenerateResult, JsonResult } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;

export async function generateText(opts: GenerateOptions): Promise<GenerateResult> {
  let lastErr: unknown;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  for (const model of modelChain()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const text = await openRouterChat({
        model,
        messages: [
          ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
          { role: "user" as const, content: opts.prompt },
        ],
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
        signal: controller.signal,
      });
      return { text, model };
    } catch (err) {
      lastErr = err;
      console.warn(`[ai] model ${model} failed, trying next:`, (err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`All models failed: ${(lastErr as Error)?.message ?? "unknown"}`);
}

/**
 * Pull the first complete JSON value out of a model response.
 *
 * Reasoning models (GLM, DeepSeek-R-style, etc.) wrap their answer in prose or
 * <think> blocks and sometimes emit more than one brace-delimited chunk. The old
 * greedy `[{...}]` match captured from the first brace to the LAST one across all
 * that noise, producing invalid JSON — which made the whole call fall back to the
 * template. This walks the string, tracks string/escape state, and returns the first
 * balanced object or array, which parses cleanly regardless of surrounding text.
 */
function extractJson(text: string): unknown {
  const stripped = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    /* fall through to scanning */
  }

  for (let i = 0; i < stripped.length; i++) {
    const open = stripped[i];
    if (open !== "{" && open !== "[") continue;
    const close = open === "{" ? "}" : "]";

    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let j = i; j < stripped.length; j++) {
      const ch = stripped[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          const candidate = stripped.slice(i, j + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break; // this opener did not yield valid JSON; try the next one
          }
        }
      }
    }
  }
  throw new Error("No JSON found in model response");
}

/** Test-only export so the extractor's robustness can be verified offline. */
export const extractJsonForTest = extractJson;

/**
 * Generate structured JSON. `validate` must return the typed value or throw;
 * a validation failure triggers the fallback model (same as a network error).
 */
export async function generateJson<T>(opts: {
  system?: string;
  prompt: string;
  validate: (raw: unknown) => T;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<JsonResult<T>> {
  let lastErr: unknown;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  for (const model of modelChain()) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const text = await openRouterChat({
        model,
        messages: [
          ...(opts.system ? [{ role: "system" as const, content: opts.system }] : []),
          { role: "user" as const, content: opts.prompt },
        ],
        temperature: opts.temperature ?? 0.6,
        maxTokens: opts.maxTokens ?? 1024,
        signal: controller.signal,
      });
      const data = opts.validate(extractJson(text));
      return { data, model };
    } catch (err) {
      lastErr = err;
      console.warn(`[ai] json via ${model} failed, trying next:`, (err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`All models failed (json): ${(lastErr as Error)?.message ?? "unknown"}`);
}
