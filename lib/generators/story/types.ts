/**
 * Children's Story Book generator — shared types.
 *
 * A story book is an image-heavy, character-consistent kids' picture book:
 * one idea → story plan → locked character → reference-conditioned page
 * illustrations (same character every page) → KDP-ready interior + cover PDF.
 */

export const STORY_AGE_RANGES = ["3-5", "6-8", "9-12"] as const;
export type StoryAgeRange = (typeof STORY_AGE_RANGES)[number];

export const STORY_ART_STYLES = ["watercolor", "cartoon", "storybook", "crayon", "papercut"] as const;
export type StoryArtStyle = (typeof STORY_ART_STYLES)[number];

/** Total interior pages including the title and "The End" pages. */
export const MIN_STORY_PAGES = 24;
export const MAX_STORY_PAGES = 32;
export const DEFAULT_STORY_PAGES = 24;

export interface StoryConfigInput {
  idea: string;
  ageRange?: StoryAgeRange;
  artStyle?: StoryArtStyle;
  /** Total interior pages (title + illustrated pages + end). Clamped 24–32. */
  pageCount?: number;
  title?: string;
  author?: string;
  seed?: number;
}

/** High-level plan produced by the text model from the idea. */
export interface StoryPlan {
  title: string;
  subtitle: string;
  logline: string;
  moral: string;
  setting: string;
  ageRange: StoryAgeRange;
  tone: string;
  description: string;
  keywords: string[];
  generatedBy: string;
}

/** One illustrated story page: narration + a scene description for the image. */
export interface StoryPageScript {
  text: string; // 1–3 short, age-graded sentences
  scenePrompt: string; // who / where / action / emotion (fed to the image model)
}
