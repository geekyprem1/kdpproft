/**
 * Story character bible + prompt builders.
 *
 * The hard problem in a picture book is character consistency: the same hero must
 * look identical on every page. That is engineered with (1) a fixed-wording
 * "descriptor" injected verbatim into every image prompt, and (2) a single locked
 * reference image fed into every page as conditioning (see images.ts / the
 * reference-conditioned FLUX Kontext model). This module produces (1); the bible
 * is derived from the story idea rather than hardcoded.
 */

import { generateJson } from "../../ai/provider";
import { isAiConfigured } from "../../ai/models";
import type { StoryArtStyle } from "./types";

export interface StoryCharacter {
  name: string;
  descriptor: string; // compiled, fixed-wording prompt fragment reused on every page
  artStyle: string; // resolved art-style descriptor
  generatedBy: string;
}

/** Human idea → a locked art-style descriptor string for the whole book. */
export const ART_STYLE_DESCRIPTORS: Record<StoryArtStyle, string> = {
  watercolor:
    "soft watercolor children's book illustration, full color, gentle rounded outlines, warm palette",
  cartoon:
    "bright flat cartoon children's book illustration, bold clean outlines, cheerful saturated colors",
  storybook:
    "classic storybook illustration, painterly, cozy warm lighting, richly detailed but gentle",
  crayon:
    "hand-drawn crayon and colored-pencil children's illustration, textured, playful, warm",
  papercut:
    "layered paper-cut collage children's illustration, flat shapes, soft shadows, bright palette",
};

export function resolveArtStyle(style?: StoryArtStyle): string {
  return ART_STYLE_DESCRIPTORS[style ?? "watercolor"] ?? ART_STYLE_DESCRIPTORS.watercolor;
}

/**
 * Build the character bible from the story idea. Falls back to a generic
 * derived descriptor when AI is unavailable so the pipeline never hard-stops.
 */
export async function buildStoryCharacter(
  idea: string,
  artStyle: string
): Promise<StoryCharacter> {
  const fallback: StoryCharacter = {
    name: "the hero",
    descriptor: `the main character of "${idea}", a single friendly, appealing kids'-book character with a clear, simple, memorable design and consistent colors`,
    artStyle,
    generatedBy: "fallback",
  };

  if (!isAiConfigured()) return fallback;

  try {
    const { data, model } = await generateJson<{ name: string; descriptor: string }>({
      system:
        "You are a children's picture-book character designer. Reply with JSON only. The descriptor must be ONE vivid sentence naming species/kind, body shape, exact colors, 2-3 distinctive features, and any signature accessory — worded so it can be repeated identically on every page to keep the character on-model.",
      prompt: `Story idea: "${idea}".
Design ONE consistent main character for this picture book.
Return JSON: {"name": string (short character name), "descriptor": string (one sentence: kind + build + exact colors + 2-3 distinctive features + accessory)}`,
      temperature: 0.6,
      maxTokens: 400,
      validate: (raw) => {
        const o = raw as Record<string, unknown>;
        const name = typeof o.name === "string" && o.name.trim() ? o.name.trim() : fallback.name;
        const descriptor =
          typeof o.descriptor === "string" && o.descriptor.trim().length > 10
            ? o.descriptor.trim()
            : fallback.descriptor;
        return { name, descriptor };
      },
    });
    return { name: data.name, descriptor: data.descriptor, artStyle, generatedBy: model };
  } catch {
    return fallback;
  }
}

/** Text-to-image prompt for the locked master reference (the visual anchor). */
export function referencePrompt(character: StoryCharacter): string {
  return `${character.artStyle}. Full-body character reference of ${character.descriptor}. Neutral standing pose, facing forward, plain white background, centered, single character, no text, no watermark.`;
}

/**
 * Reference-conditioned page prompt. The reference image is passed separately as
 * conditioning; this text re-states the descriptor verbatim and describes only the
 * new scene, keeping the design identical across pages.
 */
export function scenePrompt(character: StoryCharacter, scene: string): string {
  return `Keep this exact character unchanged — ${character.descriptor}. Same design and same colors as the reference image. Show the character ${scene}. ${character.artStyle}. Full scene with a simple background, friendly mood, single main character, no text, no letters, no watermark.`;
}

/** Cover illustration prompt (character on-model, cover-framed, leaves room for title). */
export function coverScenePrompt(character: StoryCharacter): string {
  return `Keep this exact character unchanged — ${character.descriptor}. Same design and same colors as the reference image. A charming children's book front-cover illustration of the character in an inviting hero pose, appealing and centered, with empty space at the top for a title. ${character.artStyle}. Single main character, no text, no letters, no watermark.`;
}
