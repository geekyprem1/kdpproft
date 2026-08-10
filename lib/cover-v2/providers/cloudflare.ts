/**
 * Cloudflare Workers AI client for Cover V2.
 *
 * The request contract is NOT documented publicly — Cloudflare's model pages hide
 * the input schema behind an interactive widget. Everything below was established
 * empirically with `npm run probe:cover-v2`:
 *
 *   generation : POST /ai/run/<model> as multipart/form-data with prompt/width/height.
 *                A JSON body is rejected: "required properties at '/' are 'multipart'".
 *   response   : JSON, base64 JPEG in result.image. output_format is ignored, so the
 *                output is always JPEG regardless of what we ask for.
 *   verify     : POST /ai/run/<vision> as JSON with OpenAI-style messages + image_url.
 */

import { coverV2Config, MAX_GEN_HEIGHT, MAX_GEN_WIDTH } from "../config";
import { CoverV2ProviderError, CoverV2SafetyError } from "../errors";

const API_ROOT = "https://api.cloudflare.com/client/v4/accounts";

/**
 * flux-2-dev is a 32B model running many diffusion steps, and at cover resolution a
 * single image can take minutes — a 3 minute ceiling aborted it mid-generation
 * during Phase 1 testing. This is also why V2 has to run as a background job rather
 * than inside a request.
 */
const GENERATE_TIMEOUT_MS = 420_000;
const VERIFY_TIMEOUT_MS = 60_000;

function endpoint(accountId: string, model: string): string {
  return `${API_ROOT}/${accountId}/ai/run/${model}`;
}

/** Cloudflare wraps errors in { errors: [{ message, code }] }. */
function describeError(body: string): { message: string; flagged: boolean } {
  try {
    const json = JSON.parse(body) as { errors?: Array<{ message?: string; code?: number }> };
    const first = json.errors?.[0];
    const message = first?.message ?? body;
    // 3030 is the content-moderation code observed during probing.
    return { message, flagged: first?.code === 3030 || /flagged/i.test(message) };
  } catch {
    return { message: body, flagged: /flagged/i.test(body) };
  }
}

async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export interface GenerateImageOptions {
  /** Full Workers AI model id, e.g. "@cf/black-forest-labs/flux-2-dev". */
  model: string;
  prompt: string;
  width: number;
  height: number;
}

/**
 * Vendors on Workers AI do not share one request contract, and it is not documented.
 * Established by benching: the Black Forest Labs FLUX.2 models require
 * multipart/form-data and reject JSON, while the Leonardo models take JSON and may
 * answer with a raw binary body instead of base64.
 */
function requestShape(model: string): "multipart" | "json" {
  return model.includes("black-forest-labs") ? "multipart" : "json";
}

/** Per-vendor dimension ceilings, both found by benching. */
function maxSideFor(model: string): { width: number; height: number } {
  // The Leonardo models reject any side over 2048.
  if (model.includes("leonardo")) return { width: 2048, height: 2048 };
  return { width: MAX_GEN_WIDTH, height: MAX_GEN_HEIGHT };
}

/**
 * Clamp a requested size to what the model accepts while preserving aspect ratio —
 * an over-size request returns an opaque error rather than a smaller image.
 */
export function clampToModel(model: string, width: number, height: number): { width: number; height: number } {
  const max = maxSideFor(model);
  const fit = Math.min(1, max.width / width, max.height / height);
  const round16 = (n: number) => Math.max(256, Math.round((n * fit) / 16) * 16);
  return { width: round16(width), height: round16(height) };
}

/** Generate one image. Returns JPEG (or PNG) bytes, whichever the vendor produced. */
export async function generateImage(opts: GenerateImageOptions): Promise<Uint8Array> {
  const { accountId, apiToken } = coverV2Config();
  const { width, height } = clampToModel(opts.model, Math.round(opts.width), Math.round(opts.height));
  const shape = requestShape(opts.model);

  // Only prompt/width/height are accepted anywhere. Sending a `steps` field makes
  // flux-2-dev return an opaque HTTP 500, so step count is not controllable.
  let init: RequestInit;
  if (shape === "multipart") {
    const form = new FormData();
    form.append("prompt", opts.prompt);
    form.append("width", String(width));
    form.append("height", String(height));
    init = { method: "POST", headers: { Authorization: `Bearer ${apiToken}` }, body: form };
  } else {
    init = {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: opts.prompt, width, height }),
    };
  }

  const res = await withTimeout(GENERATE_TIMEOUT_MS, (signal) =>
    fetch(endpoint(accountId, opts.model), { ...init, signal })
  );

  // Some vendors stream the image back directly rather than wrapping it in JSON.
  const contentType = res.headers.get("content-type") ?? "";
  if (res.ok && !contentType.includes("application/json")) {
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength < 1000) throw new CoverV2ProviderError("Image generation returned an empty image");
    return bytes;
  }

  const body = await res.text();
  if (!res.ok) {
    const { message, flagged } = describeError(body);
    if (flagged) throw new CoverV2SafetyError(message);
    throw new CoverV2ProviderError(`Image generation failed: ${message.slice(0, 300)}`, res.status);
  }

  let image: string | undefined;
  try {
    const json = JSON.parse(body) as { result?: { image?: string } | string };
    image = typeof json.result === "string" ? json.result : json.result?.image;
  } catch {
    throw new CoverV2ProviderError("Image generation returned an unreadable response", res.status);
  }
  if (!image) throw new CoverV2ProviderError("Image generation returned no image", res.status);

  const bytes = new Uint8Array(Buffer.from(image, "base64"));
  if (bytes.byteLength < 1000) throw new CoverV2ProviderError("Image generation returned an empty image");
  return bytes;
}

/**
 * Read the text out of a generated cover. Returns the raw transcription; comparison
 * against the requested strings happens in verify.ts.
 */
export async function transcribeImageText(jpeg: Uint8Array): Promise<string> {
  const { accountId, apiToken, verifyModel } = coverV2Config();

  const res = await withTimeout(VERIFY_TIMEOUT_MS, (signal) =>
    fetch(endpoint(accountId, verifyModel), {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "Transcribe every word of text visible in this image, exactly as spelled. " +
                  "Preserve spelling mistakes exactly as they appear. Reply with only those words.",
              },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${Buffer.from(jpeg).toString("base64")}` },
              },
            ],
          },
        ],
        max_tokens: 256,
      }),
      signal,
    })
  );

  const body = await res.text();
  if (!res.ok) {
    throw new CoverV2ProviderError(`Text verification failed: ${describeError(body).message.slice(0, 200)}`, res.status);
  }

  try {
    const json = JSON.parse(body) as {
      result?: string | { response?: string; description?: string; text?: string };
    };
    const r = json.result;
    const said = typeof r === "string" ? r : r?.response ?? r?.description ?? r?.text ?? "";
    return said.trim();
  } catch {
    throw new CoverV2ProviderError("Text verification returned an unreadable response", res.status);
  }
}
