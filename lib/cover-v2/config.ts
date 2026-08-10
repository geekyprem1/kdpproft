/**
 * Cover Generator V2 (Beta) — configuration and gating.
 *
 * V2 runs on Cloudflare Workers AI: the image model composes the whole cover,
 * typography included, instead of us overlaying our own type on its artwork.
 *
 * Every model id is an env value so the default can be changed without a deploy.
 * That matters commercially: flux-2-dev has the best text rendering of the open
 * FLUX family but is priced per tile per step, which makes it roughly an order of
 * magnitude dearer at print resolution than the step-distilled klein models. While
 * a Cloudflare startup credit is covering usage, dev is the right default; when
 * that credit ends, switching COVER_V2_MODEL to klein-9b keeps margins intact.
 */

/**
 * Default render model.
 *
 * klein-9b, not dev, despite dev spelling more reliably (4/4 vs klein's 1-in-2 in
 * the Phase 1 bench). The reason is latency: klein is ~7s per cover against dev's
 * 150–200s, which makes a 2-concept generation feel instant instead of a
 * seven-minute wait. The repair loop plus the hybrid fallback are what make that
 * safe — a klein cover that misspells the title is retried and, failing that, has
 * its type set by the V1 engine instead. Set COVER_V2_MODEL to flux-2-dev to trade
 * speed back for first-pass accuracy.
 */
const DEFAULT_MODEL = "@cf/black-forest-labs/flux-2-klein-9b";
/** Higher-quality, much slower alternative — reliable text, 150–200s per cover. */
const DEFAULT_DRAFT_MODEL = "@cf/black-forest-labs/flux-2-klein-9b";
/**
 * Vision model that reads the rendered cover back to check its spelling.
 * Verified working: llama-4-scout transcribed a generated cover title exactly, and
 * correctly caught a real "QUHET MORNNGS" misspelling from a draft-model cover.
 * moondream3.1 returns an empty result, and llama-3.2-11b-vision needs a model
 * agreement accepted on the account first (403 until then).
 */
const DEFAULT_VERIFY_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

/**
 * Two, not three. Measured: flux-2-dev takes 150–200s per cover at these sizes, so
 * three concepts is a ten-minute wait. Two keeps a Beta generation under about seven
 * minutes while still giving the buyer a choice.
 */
const DEFAULT_CONCEPTS = 2;
const MIN_CONCEPTS = 1;
const MAX_CONCEPTS = 3;

/**
 * Verified generation ceiling on Workers AI. 1408×2112 succeeds; 1536×2304 returns
 * a 500. A 6×9 cover at 1408×2112 is only ~235 DPI, so the pipeline must still
 * resize up to 1800×2700 for KDP's 300 DPI requirement.
 */
export const MAX_GEN_WIDTH = 1408;
export const MAX_GEN_HEIGHT = 2112;

/** KDP wants 300 DPI for print covers. */
export const PRINT_DPI = 300;

/** The models return JPEG regardless of any output_format field. */
export const GENERATED_IMAGE_MIME = "image/jpeg";

export interface CoverV2Config {
  accountId: string;
  apiToken: string;
  model: string;
  draftModel: string;
  verifyModel: string;
  concepts: number;
}

const env = (key: string): string => (process.env[key] ?? "").trim();

/** True when Cloudflare credentials are present. */
export function isCloudflareAiConfigured(): boolean {
  return Boolean(env("CLOUDFLARE_ACCOUNT_ID") && env("CLOUDFLARE_AI_TOKEN"));
}

/**
 * Why V2 is unavailable, or null when it is ready. Kept as a reason rather than a
 * boolean so the Beta page can tell the operator what is missing instead of just
 * hiding itself.
 */
export type CoverV2Unavailable = "disabled" | "not_configured";

export function coverV2Unavailable(): CoverV2Unavailable | null {
  if (env("COVER_V2_ENABLED") !== "1") return "disabled";
  if (!isCloudflareAiConfigured()) return "not_configured";
  return null;
}

/** True only when the Beta flag is on AND Cloudflare is reachable. */
export function isCoverV2Enabled(): boolean {
  return coverV2Unavailable() === null;
}

function clampConcepts(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return DEFAULT_CONCEPTS;
  return Math.min(MAX_CONCEPTS, Math.max(MIN_CONCEPTS, n));
}

/**
 * Resolved V2 configuration. Throws when Cloudflare is not configured, so callers
 * cannot accidentally attempt a generation with missing credentials.
 */
export function coverV2Config(): CoverV2Config {
  const accountId = env("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = env("CLOUDFLARE_AI_TOKEN");
  if (!accountId || !apiToken) {
    throw new Error("Cloudflare Workers AI is not configured (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_AI_TOKEN)");
  }
  return {
    accountId,
    apiToken,
    model: env("COVER_V2_MODEL") || DEFAULT_MODEL,
    draftModel: env("COVER_V2_DRAFT_MODEL") || DEFAULT_DRAFT_MODEL,
    verifyModel: env("COVER_V2_VERIFY_MODEL") || DEFAULT_VERIFY_MODEL,
    concepts: clampConcepts(env("COVER_V2_CONCEPTS")),
  };
}

/** Model ids for display in the Beta UI (no secrets). */
export function coverV2ModelSummary(): { model: string; draftModel: string; verifyModel: string; concepts: number } {
  return {
    model: env("COVER_V2_MODEL") || DEFAULT_MODEL,
    draftModel: env("COVER_V2_DRAFT_MODEL") || DEFAULT_DRAFT_MODEL,
    verifyModel: env("COVER_V2_VERIFY_MODEL") || DEFAULT_VERIFY_MODEL,
    concepts: clampConcepts(env("COVER_V2_CONCEPTS")),
  };
}
