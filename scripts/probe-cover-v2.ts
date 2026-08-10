/**
 * Cover V2 (Beta) — Cloudflare Workers AI diagnostic.
 *
 *   node --env-file=.env.local --import tsx scripts/probe-cover-v2.ts
 *
 * Verifies the whole V2 contract against the live account, cheaply:
 *   1. token works and the configured models are reachable
 *   2. image generation returns an image at the requested size
 *   3. the vision model can read the cover's text back
 *
 * Generates ONE small image (~$0.016). Nothing is written to the database or
 * object storage.
 *
 * Contract established by probing (the docs do not publish the input schema):
 *   generation : POST /ai/run/<model>, multipart/form-data, fields prompt/width/height
 *   response   : JSON, base64 JPEG in result.image (output_format is ignored)
 *   max size   : 1408×2112 (1536×2304 returns a 500)
 *   verify     : POST /ai/run/<vision>, JSON, OpenAI-style messages with image_url
 */

import { mkdir, writeFile } from "node:fs/promises";
import { coverV2ModelSummary, isCloudflareAiConfigured, MAX_GEN_HEIGHT, MAX_GEN_WIDTH } from "../lib/cover-v2/config";

const ACCOUNT = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
const TOKEN = (process.env.CLOUDFLARE_AI_TOKEN ?? "").trim();
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai`;
const auth = { Authorization: `Bearer ${TOKEN}` };
const OUT = "output/cover-v2-probe";

const TITLE = "QUIET MORNINGS";
const PROMPT =
  "Front cover artwork for an original book. A single lit paper lantern on a stone ledge at dawn, " +
  "soft mist behind it, warm amber and deep teal palette, calm and premium. " +
  `Render exactly this text as the cover title and no other words: "${TITLE}". ` +
  "Heavy geometric sans-serif, all capitals, tight letter spacing, cream text on the dark upper area.";

const short = (s: string, n = 180) => {
  const c = s.replace(/\s+/g, " ").trim();
  return c.length > n ? `${c.slice(0, n)}…` : c;
};

/** JPEG frame dimensions, read from the SOF marker. */
function jpegSize(b: Uint8Array): { width: number; height: number } | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    const len = (b[i + 2] << 8) | b[i + 3];
    if ([0xc0, 0xc1, 0xc2, 0xc9, 0xca].includes(marker)) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + len;
  }
  return null;
}

async function checkModels(): Promise<boolean> {
  const models = coverV2ModelSummary();
  console.log("── 1. Token and models ─────────────────────────");
  const res = await fetch(`${API}/models/search?per_page=500`, { headers: auth });
  if (!res.ok) {
    console.log(`  ✗ HTTP ${res.status} — a 403 here means the token lacks Workers AI permission`);
    return false;
  }
  console.log("  ✓ token accepted");
  const json = (await res.json()) as { result?: Array<{ name?: string }> };
  const names = (json.result ?? []).map((m) => m.name ?? "");
  let ok = true;
  for (const [label, id] of [
    ["final ", models.model],
    ["draft ", models.draftModel],
    ["verify", models.verifyModel],
  ] as const) {
    const present = names.includes(id);
    if (!present) ok = false;
    console.log(`  ${present ? "✓" : "✗"} ${label}: ${id}`);
  }
  return ok;
}

async function generate(): Promise<Uint8Array | null> {
  console.log("\n── 2. Image generation (~$0.016) ───────────────");
  const { draftModel } = coverV2ModelSummary();
  const width = 1024;
  const height = 1536;

  const form = new FormData();
  form.append("prompt", PROMPT);
  form.append("width", String(width));
  form.append("height", String(height));

  const res = await fetch(`${API}/run/${draftModel}`, { method: "POST", headers: auth, body: form });
  const text = await res.text();
  if (!res.ok) {
    console.log(`  ✗ HTTP ${res.status}: ${short(text)}`);
    if (text.includes("flagged")) {
      console.log("    Note: the safety filter rejects prompts echoing well-known titles.");
    }
    return null;
  }

  let bytes: Uint8Array;
  try {
    const json = JSON.parse(text) as { result?: { image?: string } };
    if (!json.result?.image) { console.log(`  ✗ 200 but no image: ${short(text)}`); return null; }
    bytes = new Uint8Array(Buffer.from(json.result.image, "base64"));
  } catch {
    console.log(`  ✗ unparseable response: ${short(text)}`);
    return null;
  }

  const size = jpegSize(bytes);
  const mp = size ? (size.width * size.height) / 1_000_000 : 0;
  console.log(`  ✓ ${size?.width}×${size?.height} JPEG, ${(bytes.byteLength / 1024).toFixed(0)} KB`);
  console.log(`    ${mp.toFixed(2)} MP ≈ $${(0.015 + Math.max(0, mp - 1) * 0.002).toFixed(4)}`);
  console.log(`    generation ceiling: ${MAX_GEN_WIDTH}×${MAX_GEN_HEIGHT} → a resize to 1800×2700 is still needed for 300 DPI`);

  await mkdir(OUT, { recursive: true });
  await writeFile(`${OUT}/draft.jpg`, bytes);
  console.log(`    saved ${OUT}/draft.jpg`);
  return bytes;
}

async function verify(bytes: Uint8Array): Promise<void> {
  console.log("\n── 3. Spelling verification ────────────────────");
  const { verifyModel } = coverV2ModelSummary();
  const res = await fetch(`${API}/run/${verifyModel}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe every word of text visible in this image, exactly as spelled. Reply with only those words." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}` } },
          ],
        },
      ],
      max_tokens: 128,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.log(`  ✗ HTTP ${res.status}: ${short(text)}`);
    return;
  }
  let said = "";
  try {
    const json = JSON.parse(text) as { result?: { response?: string; description?: string } | string };
    const r = json.result;
    said = typeof r === "string" ? r : (r?.response ?? r?.description ?? "");
  } catch { /* ignore */ }

  if (!said.trim()) {
    console.log(`  ✗ empty transcription — this model cannot be used for verification`);
    return;
  }
  console.log(`  model read: "${short(said, 160)}"`);
  const norm = said.toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ");
  console.log(`  ${norm.includes(TITLE) ? "✓ title transcribed correctly — the repair loop can trust this" : "! title not matched — the repair loop would retry"}`);
}

async function main(): Promise<void> {
  if (!isCloudflareAiConfigured()) {
    console.error("✗ CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_AI_TOKEN missing from .env.local");
    process.exit(1);
  }
  console.log("Cover V2 — Cloudflare Workers AI diagnostic\n");
  const modelsOk = await checkModels();
  const bytes = await generate();
  if (bytes) await verify(bytes);
  console.log(`\n${modelsOk && bytes ? "✓ V2 engine reachable and working." : "✗ Fix the issues above before building on this."}`);
  if (!modelsOk || !bytes) process.exitCode = 1;
}

main().catch((e) => { console.error("probe failed:", e); process.exit(1); });
