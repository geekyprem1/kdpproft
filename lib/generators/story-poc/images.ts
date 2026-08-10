/**
 * Storybook POC image generation.
 *
 * - Reference image: FLUX Schnell (text-to-image), the locked character anchor.
 * - Scene images: FLUX Kontext (image-to-image), conditioned on the reference so
 *   the SAME character appears in each new scene.
 *
 * Two backends are supported, picked automatically:
 *   1. SiliconFlow (preferred when SILICONFLOW_API_KEY is set) — FLUX.1-Kontext-dev
 *      at ~$0.015/image, reference image passed as a base64 data URI.
 *   2. Replicate (when REPLICATE_API_TOKEN is set) — flux-kontext-pro/dev.
 *
 * Offline (neither key): deterministic colored placeholders so the harness/report
 * runs — but this is NOT a real consistency proof.
 */

import { renderPng } from "../../pdf/render";

// --- Replicate model slugs ---
const SCHNELL = "black-forest-labs/flux-schnell";
const KONTEXT = process.env.STORY_KONTEXT_MODEL || "black-forest-labs/flux-kontext-pro";

// --- SiliconFlow model ids (OpenAI-style /v1/images/generations endpoint) ---
const SF_ENDPOINT = "https://api.siliconflow.com/v1/images/generations";
const SF_SCHNELL = process.env.STORY_SF_REFERENCE_MODEL || "black-forest-labs/FLUX.1-schnell";
const SF_KONTEXT = process.env.STORY_SF_KONTEXT_MODEL || "black-forest-labs/FLUX.1-Kontext-dev";
// Kontext follows the reference image's aspect; square keeps the picture-book trim.
const SF_IMAGE_SIZE = process.env.STORY_SF_IMAGE_SIZE || "1024x1024";

export function isSiliconFlowConfigured(): boolean {
  return Boolean(process.env.SILICONFLOW_API_KEY);
}

export function isReplicateConfigured(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

export function isImageConfigured(): boolean {
  return isSiliconFlowConfigured() || isReplicateConfigured();
}

/** Which Kontext model the report should name. SiliconFlow takes precedence. */
export const KONTEXT_MODEL = isSiliconFlowConfigured() ? SF_KONTEXT : KONTEXT;

interface Prediction {
  status: string;
  output?: string[] | string;
  error?: string;
  urls?: { get?: string };
}

async function replicateRun(model: string, input: Record<string, unknown>): Promise<Uint8Array> {
  const token = process.env.REPLICATE_API_TOKEN!;
  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`Replicate ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);

  let pred = (await res.json()) as Prediction;
  for (let i = 0; pred.status !== "succeeded" && pred.urls?.get && i < 60; i++) {
    if (pred.status === "failed" || pred.status === "canceled") break;
    await new Promise((r) => setTimeout(r, 1500));
    pred = (await (await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` } })).json()) as Prediction;
  }
  if (pred.status !== "succeeded") throw new Error(`Replicate ${model} failed: ${pred.error ?? pred.status}`);

  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!url) throw new Error(`Replicate ${model} returned no image`);
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

export function toDataUri(bytes: Uint8Array): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

interface SfResponse {
  images?: Array<{ url?: string }>;
  data?: Array<{ url?: string }>;
  error?: unknown;
}

/**
 * SiliconFlow image call. `image` (a base64 data URI) is optional — present for the
 * reference-conditioned Kontext scenes, absent for the text-to-image reference sheet.
 */
const SF_TIMEOUT_MS = Number(process.env.STORY_SF_TIMEOUT_MS) || 120_000;

/** fetch with an AbortController timeout so a hung connection fails cleanly (and retries). */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function siliconflowOnce(
  model: string,
  prompt: string,
  opts: { seed: number; image?: string },
): Promise<Uint8Array> {
  const key = process.env.SILICONFLOW_API_KEY!;
  const body: Record<string, unknown> = {
    model,
    prompt,
    image_size: SF_IMAGE_SIZE,
    seed: opts.seed % 9999999999,
    output_format: "png",
  };
  if (opts.image) body.image = opts.image;

  const res = await fetchWithTimeout(
    SF_ENDPOINT,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    SF_TIMEOUT_MS
  );
  if (!res.ok) throw new Error(`SiliconFlow ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const json = (await res.json()) as SfResponse;
  const url = json.images?.[0]?.url ?? json.data?.[0]?.url;
  if (!url) throw new Error(`SiliconFlow ${model} returned no image: ${JSON.stringify(json).slice(0, 200)}`);

  const dl = await fetchWithTimeout(url, {}, SF_TIMEOUT_MS);
  if (!dl.ok) throw new Error(`SiliconFlow ${model} image download ${dl.status}`);
  const bytes = new Uint8Array(await dl.arrayBuffer());
  if (bytes.byteLength < 1000) throw new Error(`SiliconFlow ${model} returned an empty image`);
  return bytes;
}

/**
 * SiliconFlow image call with retry. `image` (a base64 data URI) is optional —
 * present for the reference-conditioned Kontext scenes, absent for the text-to-image
 * reference sheet. Retries transient network failures ("fetch failed") with backoff.
 */
/** undici hides the real network failure in error.cause — surface it for debugging. */
function errorDetail(err: unknown): string {
  const e = err as { message?: string; cause?: { code?: string; message?: string } };
  const cause = e?.cause ? ` (${e.cause.code ?? ""} ${e.cause.message ?? ""})`.trim() : "";
  return `${e?.message ?? String(err)}${cause}`;
}

async function siliconflowRun(
  model: string,
  prompt: string,
  opts: { seed: number; image?: string },
): Promise<Uint8Array> {
  const MAX_ATTEMPTS = 4;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await siliconflowOnce(model, prompt, opts);
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, attempt * 2500));
    }
  }
  throw new Error(`SiliconFlow ${model} failed after ${MAX_ATTEMPTS} attempts: ${errorDetail(lastErr)}`);
}

/** Master character reference (text-to-image). */
export async function generateReference(opts: { prompt: string; seed: number }): Promise<Uint8Array> {
  if (isSiliconFlowConfigured()) {
    return siliconflowRun(SF_SCHNELL, opts.prompt, { seed: opts.seed });
  }
  if (!isReplicateConfigured()) return placeholder(opts.seed, "reference");
  return replicateRun(SCHNELL, {
    prompt: opts.prompt,
    aspect_ratio: "1:1",
    output_format: "png",
    megapixels: "1",
    seed: opts.seed,
  });
}

/** Scene image conditioned on the reference (FLUX Kontext image-to-image). */
export async function generateScene(opts: {
  prompt: string;
  referenceDataUri: string;
  seed: number;
}): Promise<Uint8Array> {
  if (isSiliconFlowConfigured()) {
    return siliconflowRun(SF_KONTEXT, opts.prompt, { seed: opts.seed, image: opts.referenceDataUri });
  }
  if (!isReplicateConfigured()) return placeholder(opts.seed, "scene");
  return replicateRun(KONTEXT, {
    prompt: opts.prompt,
    input_image: opts.referenceDataUri,
    aspect_ratio: "1:1",
    output_format: "png",
    seed: opts.seed,
  });
}

/** Deterministic colored dragon placeholder (green body, yellow belly, red scarf). */
async function placeholder(seed: number, kind: string): Promise<Uint8Array> {
  const sky = kind === "scene" ? `hsl(${(seed * 37) % 360} 60% 88%)` : "#ffffff";
  const html = `<!doctype html><html><head><style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style></head><body>
    <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="600" height="600" fill="${sky}"/>
      <ellipse cx="300" cy="340" rx="150" ry="170" fill="#2e8b57" stroke="#14532d" stroke-width="6"/>
      <ellipse cx="300" cy="380" rx="80" ry="110" fill="#ffe066" stroke="#caa000" stroke-width="4"/>
      <rect x="210" y="250" width="180" height="34" rx="16" fill="#e23b3b" stroke="#9b1c1c" stroke-width="4"/>
      <circle cx="265" cy="210" r="18" fill="#fff" stroke="#14532d" stroke-width="4"/>
      <circle cx="335" cy="210" r="18" fill="#fff" stroke="#14532d" stroke-width="4"/>
      <circle cx="265" cy="212" r="7" fill="#111"/><circle cx="335" cy="212" r="7" fill="#111"/>
      <text x="300" y="560" font-family="Arial" font-size="20" text-anchor="middle" fill="#333">PLACEHOLDER · ${kind}</text>
    </svg></body></html>`;
  return renderPng(html, { widthIn: 6, heightIn: 6, dpi: 96 });
}
