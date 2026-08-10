export type CoverGenre =
  | "business"
  | "self_help"
  | "puzzle"
  | "kids"
  | "coloring"
  | "fiction";

export const COVER_GENRES: CoverGenre[] = ["business", "self_help", "puzzle", "kids", "coloring", "fiction"];

export const COVER_GENRE_LABELS: Record<CoverGenre, string> = {
  business: "Business",
  self_help: "Self Help",
  puzzle: "Puzzle Book",
  kids: "Kids Book",
  coloring: "Coloring Book",
  fiction: "Fiction",
};

/**
 * V2 — three genuinely different cover concepts:
 *  fullImage   : cinematic full-bleed image, large title, professional hierarchy
 *  typographyFirst : bestseller title-block dominant, minimal image, thumbnail-readable
 *  modernCommercial: image + strong design band — modern KDP commercial style
 */
export type ConceptLayout = "fullImage" | "typographyFirst" | "modernCommercial";
export const CONCEPT_LAYOUTS: ConceptLayout[] = ["fullImage", "typographyFirst", "modernCommercial"];
export const CONCEPT_LABELS: Record<ConceptLayout, string> = {
  fullImage: "Premium Full Image",
  typographyFirst: "Bestseller Typography",
  modernCommercial: "Modern Commercial",
};

/**
 * V4 commercial composition — what carries the cover, by genre. This is the single
 * source of truth that drives prompts (how big the subject is), templates (how much
 * room typography gets), and scoring (which dimensions are weighted highest).
 *
 *  character  — a hero character sells the book; artwork dominates 60–80%, title supports.
 *  artwork    — a signature theme/scene sells it (puzzle pieces, coloring art, cinematic
 *               fiction); artwork dominates, title supports.
 *  typography — the title sells the book (business, self-help); typography dominates,
 *               artwork is atmospheric and secondary.
 */
export type LayoutPriority = "character" | "artwork" | "typography";

export const GENRE_PRIORITY: Record<CoverGenre, LayoutPriority> = {
  kids: "character",
  puzzle: "artwork",
  coloring: "artwork",
  fiction: "artwork",
  business: "typography",
  self_help: "typography",
};

/** True when the artwork (not the typography) is the primary commercial driver. */
export function isArtworkDominant(genre: CoverGenre): boolean {
  return GENRE_PRIORITY[genre] !== "typography";
}

export interface CoverInput {
  title: string;
  subtitle?: string;
  author?: string;
  genre: CoverGenre;
  mood?: string;
  artStyle?: string;
  audience?: string;
  niche?: string;
  opportunityScore?: number;
  trim?: string;
}

export interface CoverBrief {
  imagePrompt: string;
  accentColor: string;   // hex, pulled from genre palette
  layout: string;
  typography: string;
  model: string;
}

/** Detailed breakdown returned alongside the overall score. */
export interface ScoreBreakdown {
  titleReadability: number;    // 0–25
  subtitleReadability: number; // 0–20
  authorVisibility: number;    // 0–15
  visualBalance: number;       // 0–20
  genreMatch: number;          // 0–10
  commercialPotential: number; // 0–10
  overall: number;             // 0–100
}

/**
 * V4 commercial-composition score — modelled on top-100 Amazon KDP covers, judged
 * separately from the technical ScoreBreakdown. All 0–100. The `overall` is a
 * genre-weighted blend (see GENRE_PRIORITY): character/artwork genres weight
 * dominance highest, typography genres weight the title treatment highest.
 */
export interface VisualQuality {
  characterDominance: number;    // how much of the cover the subject/character occupies (target 60–80%)
  thumbnailVisibility: number;   // title + subject still recognizable at ~120px search-result size
  visualHierarchy: number;       // does the dominant element match the genre's ideal priority order
  bestsellerSimilarity: number;  // resemblance to top-performing KDP layouts for this genre
  typographyBalance: number;     // title fit + clean (uncluttered) text zone
  commercialAppeal: number;      // color richness + tonal balance
  overall: number;
}

export interface CoverConcept {
  layout: ConceptLayout;
  seed: number;
  score: number;           // overall 0-100 for backward compat
  breakdown: ScoreBreakdown;
  /** V3 artwork-first quality score (separate from breakdown). */
  visualQuality?: VisualQuality;
  /** "image" = real Replicate generation; "gradient" = CSS fallback. Always present on V2 concepts. */
  bg_source?: "image" | "gradient";
}

export interface BuiltConcept {
  concept: CoverConcept;
  bytes: Uint8Array;
}

export interface CoverResult {
  brief: CoverBrief;
  concepts: BuiltConcept[];
}
