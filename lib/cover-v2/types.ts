/**
 * Cover Generator V2 (Beta) — shared types.
 *
 * V2 stores its results in the same `covers` table as V1 (migration 0022 adds
 * `engine` and `design_brief`), so downloads, PDF export and use-for-book work
 * unchanged. The V2-specific per-concept facts live inside the `concepts` jsonb.
 */

import type { CoverGenre } from "../cover/types";
import type { CoverV2Style } from "./styles";

/**
 * The art director's output. Typography is described in WORDS on purpose — the
 * image model chooses the actual typeface, which is the whole point of V2.
 */
export interface CoverV2Brief {
  /** One-line visual concept for the artwork. */
  concept: string;
  /** Where the title, art and author sit relative to each other. */
  composition: string;
  /** 2–4 colour names; not hex, so the model can interpret them. */
  palette: string[];
  /** e.g. "heavy geometric sans-serif, all caps, tight letter spacing". */
  typographyInstruction: string;
  titleTreatment: string;
  authorTreatment: string;
  mood: string;
  /** Which model wrote this brief, for debugging and reproducibility. */
  model: string;
}

/** The exact strings the cover must display, and nothing else. */
export interface CoverV2TextSpec {
  title: string;
  subtitle?: string;
  author?: string;
}

/**
 * Whether the type on the delivered cover came from the image model, or from the
 * V1 HTML typography engine after the model failed verification. Surfaced in the
 * UI: a buyer is entitled to know which path produced their cover.
 */
export type CoverV2TextSource = "model" | "hybrid";

export interface CoverV2Verification {
  ok: boolean;
  /** What the vision model actually read back from the image. */
  transcribed: string;
  /** Human-readable reason when ok is false. */
  reason?: string;
}

export interface CoverV2Concept {
  index: number;
  seed: number;
  textSource: CoverV2TextSource;
  textVerified: boolean;
  verifyAttempts: number;
  /** Final stored pixel dimensions, asserted against the KDP spec before saving. */
  finalPx: { width: number; height: number };
  model: string;
  /** Reuses V1's commercial scorer so both engines are comparable. */
  score: number;
}

export interface CoverV2Input {
  title: string;
  subtitle?: string;
  author?: string;
  genre: CoverGenre;
  audience?: string;
  niche?: string;
  mood?: string;
  trim: string;
  /** Visual style preset — constrains the look so results are repeatable. */
  style?: CoverV2Style;
}
