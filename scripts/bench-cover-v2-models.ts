/**
 * Cover V2 model bench — which model inside the Cloudflare credit can actually set
 * type on a cover?
 *
 *   node --env-file=.env.local --import tsx scripts/bench-cover-v2-models.ts
 *
 * Runs the same brief and text contract through every candidate, reads the result
 * back with the vision model, and reports spelling, latency and estimated cost.
 *
 * Request shapes differ by vendor — the FLUX.2 models require multipart/form-data
 * while the Leonardo models take JSON — so each is attempted both ways.
 *
 * Cost: a few cents per FLUX/Leonardo run, up to ~$0.17 for a full-size dev run.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { generateCoverV2Brief } from "../lib/cover-v2/brief";
import { buildImagePrompt } from "../lib/cover-v2/prompt";
import { transcribeImageText } from "../lib/cover-v2/providers/cloudflare";
import { compareTranscription } from "../lib/cover-v2/verify";
import { generationPixels, jpegSize, pngSize, targetPixels } from "../lib/cover-v2/geometry";
import type { CoverV2Input } from "../lib/cover-v2/types";

const ACCOUNT = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
const TOKEN = (process.env.CLOUDFLARE_AI_TOKEN ?? "").trim();
const RUN = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run`;
const OUT = "output/cover-v2-bench";

const DEV = "@cf/black-forest-labs/flux-2-dev";

interface Candidate {
  label: string;
  model: string;
  /** Fraction of the full generation size. dev is billed per tile, so size matters. */
  scale?: number;
  /** Per-model dimension ceiling — the Leonardo models reject anything over 2048. */
  maxSide?: number;
}

const CANDIDATES: Candidate[] = [
  { label: "flux-2-klein-9b", model: "@cf/black-forest-labs/flux-2-klein-9b" },
  { label: "leonardo/lucid-origin", model: "@cf/leonardo/lucid-origin", maxSide: 2048 },
  { label: "leonardo/phoenix-1.0", model: "@cf/leonardo/phoenix-1.0", maxSide: 2048 },
  // dev is included last: it is 25-30x slower than the others and has repeatedly
  // timed out at cover resolution, so it should not delay the useful comparisons.
  { label: "flux-2-dev", model: DEV, scale: 0.6 },
];

const INPUT: CoverV2Input = {
  title: "Dino Adventure",
  subtitle: "A Fun Journey Through the Prehistoric World",
  author: "Emma Carter",
  genre: "kids",
  trim: "6x9",
};

function short(s: string, n = 120): string {
  const c = s.replace(/\s+/g, " ").trim();
  return c.length > n ? `${c.slice(0, n)}…` : c;
}

/** klein/Leonardo bill per megapixel; dev bills per 512×512 tile per step. */
function estimateCost(model: string, width: number, height: number): number {
  if (model === DEV) {
    return Math.ceil(width / 512) * Math.ceil(height / 512) * 28 * 0.00041;
  }
  const mp = (width * height) / 1_000_000;
  return 0.015 + Math.max(0, mp - 1) * 0.002;
}

function decode(body: string): Uint8Array | null {
  try {
    const json = JSON.parse(body) as { result?: { image?: string } | string };
    const image = typeof json.result === "string" ? json.result : json.result?.image;
    if (typeof image === "string" && image.length > 100) {
      return new Uint8Array(Buffer.from(image, "base64"));
    }
  } catch {
    /* not JSON */
  }
  return null;
}

/** Try multipart first (FLUX.2), then JSON (Leonardo and the rest). */
async function generate(
  model: string,
  prompt: string,
  width: number,
  height: number
): Promise<{ bytes: Uint8Array; shape: string } | { error: string }> {
  const auth = { Authorization: `Bearer ${TOKEN}` };

  const form = new FormData();
  form.append("prompt", prompt);
  form.append("width", String(width));
  form.append("height", String(height));

  const attempts: Array<{ shape: string; init: RequestInit }> = [
    { shape: "multipart", init: { method: "POST", headers: auth, body: form } },
    {
      shape: "json",
      init: {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, width, height }),
      },
    },
  ];

  let lastError = "no attempt succeeded";
  for (const a of attempts) {
    let res: Response;
    try {
      res = await fetch(`${RUN}/${model}`, a.init);
    } catch (e) {
      lastError = (e as Error).message;
      continue;
    }
    const type = res.headers.get("content-type") ?? "";

    if (res.ok && !type.includes("application/json")) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength > 1000) return { bytes, shape: `${a.shape}/binary` };
      lastError = "empty binary body";
      continue;
    }

    const body = await res.text();
    if (!res.ok) {
      lastError = short(body, 140);
      continue;
    }
    const bytes = decode(body);
    if (bytes) return { bytes, shape: `${a.shape}/base64` };
    lastError = `200 but no image (${short(body, 100)})`;
  }
  return { error: lastError };
}

async function main(): Promise<void> {
  if (!ACCOUNT || !TOKEN) {
    console.error("Cloudflare env missing");
    process.exit(1);
  }
  await mkdir(OUT, { recursive: true });

  console.log("Cover V2 model bench — candidates inside the Cloudflare credit\n");
  console.log(`  title    : "${INPUT.title}"`);
  console.log(`  subtitle : "${INPUT.subtitle}"`);
  console.log(`  author   : "${INPUT.author}"`);
  console.log(`  genre    : ${INPUT.genre}\n`);

  const brief = await generateCoverV2Brief(INPUT);
  const prompt = buildImagePrompt({ brief, text: INPUT, genre: INPUT.genre });
  console.log(`  brief by ${brief.model}\n`);

  const full = generationPixels(targetPixels("6x9"));
  const rows: string[] = [];

  for (const c of CANDIDATES) {
    // Respect each model's own ceiling while keeping the cover's aspect ratio.
    const ceiling = c.maxSide ?? Number.POSITIVE_INFINITY;
    const fit = Math.min(c.scale ?? 1, ceiling / full.width, ceiling / full.height);
    const width = Math.round((full.width * fit) / 16) * 16;
    const height = Math.round((full.height * fit) / 16) * 16;

    process.stdout.write(`  ${c.label.padEnd(24)} `);
    const started = Date.now();
    const result = await generate(c.model, prompt, width, height);
    const seconds = (Date.now() - started) / 1000;

    if ("error" in result) {
      console.log(`✗ ${seconds.toFixed(0)}s — ${result.error}`);
      rows.push(`| ${c.label} | error | — | ${seconds.toFixed(0)}s | — |`);
      continue;
    }

    const size = jpegSize(result.bytes) ?? pngSize(result.bytes) ?? { width, height };
    const cost = estimateCost(c.model, size.width, size.height);
    const ext = result.bytes[0] === 0x89 ? "png" : "jpg";
    await writeFile(`${OUT}/${c.label.replace(/[^a-z0-9]+/gi, "-")}.${ext}`, result.bytes);

    let spelling = "not checked";
    let ok = false;
    try {
      const said = await transcribeImageText(result.bytes);
      const verdict = compareTranscription(said, INPUT);
      ok = verdict.ok;
      spelling = verdict.ok ? "✓ spelled" : `✗ ${short(verdict.reason ?? "", 70)}`;
      if (!verdict.ok) spelling += `\n${" ".repeat(28)}read: "${short(said, 90)}"`;
    } catch (e) {
      spelling = `verify failed (${short((e as Error).message, 60)})`;
    }

    console.log(
      `${ok ? "✓" : "✗"} ${size.width}×${size.height} ${ext} · ${seconds.toFixed(0)}s · ~$${cost.toFixed(3)} · ${result.shape}`
    );
    console.log(`${" ".repeat(26)}${spelling}`);
    rows.push(
      `| ${c.label} | ${ok ? "pass" : "fail"} | ${size.width}×${size.height} | ${seconds.toFixed(0)}s | $${cost.toFixed(3)} |`
    );
  }

  console.log("\n| model | spelling | size | time | est. cost |");
  console.log("|---|---|---|---|---|");
  for (const r of rows) console.log(r);
  console.log(`\n  images: ${OUT}/  — open them and judge the art, not just the text`);
}

main().catch((e) => {
  console.error("bench failed:", e);
  process.exit(1);
});
