/**
 * Coloring-page image generation via Replicate (FLUX Schnell).
 *
 * When REPLICATE_API_TOKEN is unset, falls back to a deterministic offline
 * placeholder so the rest of the pipeline (validation, PDF, book assembly) is
 * fully testable without API access or cost.
 */

import { renderPng } from "../../pdf/render";

const FLUX_MODEL = "black-forest-labs/flux-schnell";

// Replicate throttles "creating predictions" (429) — harshly while the account has
// < $10 credit (60/min, burst 5). We retry the prediction POST a few times with
// backoff so a transient throttle doesn't fail an otherwise-successful book.
const MAX_REPLICATE_TRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isReplicateConfigured(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

interface Prediction {
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string[] | string;
  error?: string;
  urls?: { get?: string };
}

async function poll(url: string, token: string): Promise<Prediction> {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const pred = (await res.json()) as Prediction;
    if (pred.status === "succeeded" || pred.status === "failed" || pred.status === "canceled") {
      return pred;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Replicate prediction timed out");
}

/** Low-level FLUX image call shared by line-art and cover-art generation, with
 *  429 backoff so a transient throttle doesn't fail the job. */
async function runFlux(prompt: string, seed: number, token: string): Promise<Uint8Array> {
  let pred: Prediction | null = null;
  for (let attempt = 0; attempt < MAX_REPLICATE_TRIES; attempt++) {
    const res = await fetch(
      `https://api.replicate.com/v1/models/${FLUX_MODEL}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          input: {
            prompt,
            aspect_ratio: "3:4",
            num_outputs: 1,
            output_format: "png",
            megapixels: "1",
            seed,
          },
        }),
      }
    );

    // Rate-limited: wait (Retry-After if provided, else exponential backoff) and retry.
    if (res.status === 429) {
      if (attempt >= MAX_REPLICATE_TRIES - 1) {
        throw new Error(`Replicate throttled (429) after ${MAX_REPLICATE_TRIES} attempts`);
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt;
      await sleep(waitMs);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Replicate error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    pred = (await res.json()) as Prediction;
    break;
  }
  if (!pred) throw new Error("Replicate: no prediction created");

  if (pred.status !== "succeeded" && pred.urls?.get) {
    pred = await poll(pred.urls.get, token);
  }
  if (pred.status !== "succeeded") {
    throw new Error(`Replicate failed: ${pred.error ?? pred.status}`);
  }

  const outUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (!outUrl) throw new Error("Replicate returned no image");

  const img = await fetch(outUrl);
  if (!img.ok) throw new Error(`Failed to fetch image: ${img.status}`);
  return new Uint8Array(await img.arrayBuffer());
}

/** Generate one black-and-white line-art PNG. `seed` makes FLUX output reproducible. */
export async function generateLineArt(opts: { prompt: string; seed: number }): Promise<Uint8Array> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return placeholderLineArt(opts);
  return runFlux(opts.prompt, opts.seed, token);
}

/** Generate one full-color cover illustration PNG for the coloring-book front cover. */
export async function generateCoverArt(opts: { prompt: string; seed: number }): Promise<Uint8Array> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return placeholderLineArt(opts);
  return runFlux(opts.prompt, opts.seed, token);
}

/**
 * Offline placeholder: a valid line-art PNG (white background, thick black
 * outlines, no shading) so the pipeline works without Replicate. Deterministic
 * by seed.
 */
export async function placeholderLineArt(opts: {
  prompt: string;
  seed: number;
}): Promise<Uint8Array> {
  // a few seeded outline shapes + the subject label, all pure black on white
  const s = opts.seed;
  const cx = 300 + (s % 120) - 60;
  const cy = 380 + ((s >> 3) % 120) - 60;
  const r = 140 + (s % 80);
  const subject = opts.prompt.split(" of ")[1]?.split(",")[0] ?? "coloring page";
  const html = `<!doctype html><html><head><style>
      html,body{margin:0;padding:0}
      svg{display:block;width:100vw;height:100vh}
    </style></head><body>
    <svg viewBox="0 0 600 800" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
      <rect width="600" height="800" fill="#ffffff"/>
      <g fill="none" stroke="#000000" stroke-width="6" stroke-linejoin="round">
        <circle cx="${cx}" cy="${cy}" r="${r}"/>
        <circle cx="${cx - 50}" cy="${cy - 30}" r="22"/>
        <circle cx="${cx + 50}" cy="${cy - 30}" r="22"/>
        <path d="M${cx - 60} ${cy + 50} q60 60 120 0"/>
        <rect x="${cx - 110}" y="${cy + r - 20}" width="220" height="120" rx="24"/>
      </g>
      <text x="300" y="760" font-family="Arial" font-size="20" text-anchor="middle" fill="#000">${subject.slice(0, 40)}</text>
    </svg></body></html>`;
  // render to a PNG bitmap (so validation has real pixels to analyze)
  return renderPng(html, { widthIn: 6, heightIn: 8, dpi: 110 });
}
