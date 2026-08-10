/**
 * Cover Generator V2 — each concept gets its own distinct AI brief + image prompt.
 * Safe-zone layouts, genre-aware typography, detailed scoring.
 *
 * Architecture:
 *   buildCovers() separates FLUX generation (sequential) from rendering (parallel).
 *   Running 3 concurrent FLUX calls against the same Replicate API key triggers the
 *   per-key concurrency limit, silently canceling 2 out of 3 predictions and causing
 *   gradient fallback. Sequential FLUX + parallel render avoids this while keeping
 *   total latency close to the same (FLUX dominates render time anyway).
 *
 * Observability:
 *   Every concept stores bg_source ("image" | "gradient") so the DB record always
 *   reveals whether real Replicate art or CSS fallback was used.
 *   All fallbacks are logged via console.error with the full error message.
 */

import { renderPng } from "../pdf/render";
import { fluxSchnell, isReplicateConfigured } from "../ai/replicate";
import { generateConceptBrief, generateCoverBrief } from "./prompt";
import { coverHtml, titleBandFor, type CoverBg } from "./templates";
import { scoreCoverDetailed, scoreVisualQuality } from "./score";
import {
  type BuiltConcept,
  type CoverBrief,
  type CoverInput,
  type CoverResult,
  type ConceptLayout,
} from "./types";

// Per-concept CSS fallback gradients used when Replicate is unavailable or fails
const CONCEPT_GRADIENTS: Record<ConceptLayout, [[string, string], [string, string], [string, string]]> = {
  fullImage:         [["#0f172a","#1e3a5f"],["#7c2d12","#9a3412"],["#064e3b","#065f46"]],
  typographyFirst:   [["#1e1b4b","#312e81"],["#450a0a","#7f1d1d"],["#042f2e","#134e4a"]],
  modernCommercial:  [["#0c1445","#1a237e"],["#4a044e","#701a75"],["#052e16","#14532d"]],
};

/** Genres that require at least one character and get a retry on FLUX failure. */
const CHARACTER_GENRES = new Set(["kids", "puzzle"]);

const dataUri = (b: Uint8Array) => `data:image/png;base64,${Buffer.from(b).toString("base64")}`;

/**
 * Fetch one FLUX image with one automatic retry for character-required genres.
 * MUST be called sequentially across concepts — concurrent calls to the same
 * Replicate API key trigger the per-key concurrency limit and silently cancel
 * predictions, causing gradient fallback even when the API is working.
 */
async function tryFluxWithRetry(
  brief: CoverBrief,
  seed: number,
  genre: string,
  layout: ConceptLayout,
  gradientIdx: number
): Promise<CoverBg> {
  if (!isReplicateConfigured()) {
    console.log(`[cover] Replicate not configured — using gradient (genre=${genre} layout=${layout})`);
    const [c1, c2] = CONCEPT_GRADIENTS[layout][gradientIdx % 3];
    return { kind: "gradient", c1, c2 };
  }

  console.log(`[cover] FLUX request: genre=${genre} layout=${layout} seed=${seed}`);

  // First attempt
  try {
    const art = await fluxSchnell({ prompt: brief.imagePrompt, seed, aspectRatio: "2:3" });
    console.log(`[cover] FLUX succeeded: genre=${genre} layout=${layout} seed=${seed} bytes=${art.byteLength}`);
    return { kind: "image", dataUri: dataUri(art) };
  } catch (firstErr) {
    console.error(`[cover] FLUX failed (attempt 1): genre=${genre} layout=${layout} seed=${seed}`, firstErr);

    // Character-required genres get one automatic retry with a shifted seed
    if (CHARACTER_GENRES.has(genre)) {
      const retrySeed = seed + 777;
      console.log(`[cover] FLUX retry: genre=${genre} layout=${layout} seed=${retrySeed}`);
      try {
        const art = await fluxSchnell({ prompt: brief.imagePrompt, seed: retrySeed, aspectRatio: "2:3" });
        console.log(`[cover] FLUX retry succeeded: genre=${genre} layout=${layout} seed=${retrySeed} bytes=${art.byteLength}`);
        return { kind: "image", dataUri: dataUri(art) };
      } catch (retryErr) {
        console.error(`[cover] FLUX retry failed: genre=${genre} layout=${layout} seed=${retrySeed}`, retryErr);
      }
    }
  }

  console.error(`[cover] Using gradient fallback: genre=${genre} layout=${layout} seed=${seed}`);
  const [c1, c2] = CONCEPT_GRADIENTS[layout][gradientIdx % 3];
  return { kind: "gradient", c1, c2 };
}

/**
 * Render and score one concept given a pre-built background.
 * bg_source tracks whether a real Replicate image or gradient fallback was used.
 */
async function renderConcept(
  input: CoverInput,
  brief: CoverBrief,
  layout: ConceptLayout,
  seed: number,
  bg: CoverBg
): Promise<BuiltConcept> {
  console.log(`[cover] Render: layout=${layout} bg=${bg.kind}`);

  const html = coverHtml({
    genre: input.genre,
    layout,
    title: input.title,
    subtitle: input.subtitle,
    author: input.author,
    bg,
    accentColor: brief.accentColor,
  });
  // allowFontCdn: the genre typography engine relies on Google Fonts; without it every
  // genre silently falls back to one generic sans and all three concepts look identical.
  const bytes = await renderPng(html, { widthIn: 6, heightIn: 9, dpi: 200, allowFontCdn: true });

  const scoreOpts = {
    titleBand: titleBandFor(layout, input.genre),
    hasSubtitle: Boolean(input.subtitle?.trim()),
    hasAuthor: Boolean(input.author?.trim()),
    titleLen: input.title.length,
    layout,
    genre: input.genre,
  };
  const breakdown = scoreCoverDetailed(bytes, scoreOpts);
  const visualQuality = scoreVisualQuality(bytes, scoreOpts);

  console.log(`[cover] Score: layout=${layout} bg=${bg.kind} commercial=${visualQuality.overall} dominance=${visualQuality.characterDominance} thumb=${visualQuality.thumbnailVisibility} technical=${breakdown.overall}`);

  return {
    concept: {
      layout,
      seed,
      // Headline score reflects commercial composition (V4); technical breakdown is kept for detail.
      score: visualQuality.overall,
      breakdown,
      visualQuality,
      bg_source: bg.kind,
    },
    bytes,
  };
}

/**
 * Build one concept end-to-end (FLUX + render + score).
 * Used by the regenerate route where sequential ordering is not required.
 * Optionally accepts a pre-built bg to skip FLUX (used internally by buildCovers).
 */
export async function buildOneConcept(
  input: CoverInput,
  brief: CoverBrief,
  layout: ConceptLayout,
  seed: number,
  gradientIdx = 0,
  prebuiltBg?: CoverBg
): Promise<BuiltConcept> {
  const bg = prebuiltBg ?? await tryFluxWithRetry(brief, seed, input.genre, layout, gradientIdx);
  return renderConcept(input, brief, layout, seed, bg);
}

/**
 * Build a single cover concept — the premium "Full Image" layout only.
 * (Previously produced 3 concepts; reduced to one to keep generation focused,
 * faster, and cheaper.)
 */
export async function buildCovers(input: CoverInput): Promise<CoverResult> {
  const layout: ConceptLayout = "fullImage";
  const seed = 142; // preserves the original fullImage seed (100 * 1 + 42)

  // AI brief (OpenRouter) → FLUX image (Replicate) → render + score.
  const brief = await generateConceptBrief(input, layout);
  const bg = await tryFluxWithRetry(brief, seed, input.genre, layout, 0);
  const concept = await renderConcept(input, brief, layout, seed, bg);

  const primaryBrief = await generateCoverBrief(input);
  return { brief: { ...primaryBrief, imagePrompt: brief.imagePrompt }, concepts: [concept] };
}
