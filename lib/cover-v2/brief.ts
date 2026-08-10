/**
 * Cover V2 art director.
 *
 * Produces a design brief for one cover. The key difference from V1: typography is
 * described in WORDS, never as a font name or CSS. The image model chooses the
 * actual typeface — that is the whole point of V2. V1 keeps the hardcoded genre
 * font stacks for anyone who wants deterministic type.
 */

import { generateJson } from "../ai/provider";
import { isAiConfigured } from "../ai/models";
import { COVER_GENRE_LABELS, type CoverGenre } from "../cover/types";
import { resolveStyle, STYLE_PRESETS } from "./styles";
import type { CoverV2Brief, CoverV2Input } from "./types";

/**
 * Per-genre direction the art director must work within. Deliberately shorter than
 * V1's profiles: V2 hands creative control to the model, so this sets the lane
 * rather than the design.
 */
const GENRE_DIRECTION: Record<CoverGenre, { look: string; type: string; palette: string }> = {
  business: {
    look: "one confident, well-lit focal subject with depth — a skyline at golden hour, an architectural detail, or a premium material texture",
    type: "heavy geometric sans-serif, all capitals, tight letter spacing, restrained and authoritative",
    palette: "deep navy and charcoal lifted by warm gold highlights",
  },
  self_help: {
    look: "a warmly lit, hopeful focal subject — a sunrise horizon, an open road, or blooming nature catching the light",
    type: "clean humanist sans-serif, mixed case, generous spacing, calm and modern",
    palette: "warm amber and sunrise gold with a soft teal accent",
  },
  puzzle: {
    look: "a large, bold puzzle or game element filling most of the frame, unmistakable at thumbnail size",
    type: "chunky playful display letters, all capitals, thick outline, high energy",
    palette: "electric blue, bright yellow and vivid primary contrast",
  },
  kids: {
    look: "a cheerful group of two to four cute cartoon animal characters together, big friendly faces, playful adventure props, faces never cropped at any edge",
    type: "rounded friendly display letters, mixed case, thick soft outline",
    palette: "rainbow brights — grass green, sky blue, sunshine yellow, warm orange",
  },
  coloring: {
    look: "cute cartoon animal characters happily colouring — holding crayons with a colouring page in front of them — surrounded by bright decorative elements, cheerful and inviting",
    type: "hand-drawn brush lettering, relaxed and artistic",
    palette: "bright cheerful colours with clear friendly accents",
  },
  fiction: {
    look: "a cinematic, atmospheric scene with dramatic light and a strong silhouette or focal figure",
    type: "engraved Roman capitals, wide letter spacing, cinematic and elegant",
    palette: "deep shadow tones with one dramatic accent light",
  },
};

/** Used when the text model is unavailable or returns something unusable. */
function fallbackBrief(input: CoverV2Input): CoverV2Brief {
  const d = GENRE_DIRECTION[input.genre];
  const style = STYLE_PRESETS[resolveStyle(input.style)];
  const subject = input.niche?.trim() || input.title;
  return {
    // The style leads and the genre supplies the subject — same precedence the AI
    // path uses, so a fallback brief still looks like the chosen style.
    concept: `${style.art}, depicting ${subject}`,
    composition: "title across the calm upper third, artwork filling the lower two thirds, author line at the bottom",
    palette: style.palette.split(/,\s*|\band\b|—/).map((p) => p.trim()).filter(Boolean).slice(0, 4),
    typographyInstruction: style.type,
    titleTreatment: "largest element on the cover, centred, easily readable at thumbnail size",
    authorTreatment: "small, bottom centre, letter-spaced capitals",
    mood: input.mood?.trim() || d.look.split(",")[0],
    model: "template",
  };
}

function stringField(raw: Record<string, unknown>, key: string, max: number): string {
  const value = raw[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} missing`);
  return value.trim().slice(0, max);
}

/** Ask the text model for one cover's design brief. Never throws — falls back. */
export async function generateCoverV2Brief(input: CoverV2Input): Promise<CoverV2Brief> {
  if (!isAiConfigured()) return fallbackBrief(input);
  const d = GENRE_DIRECTION[input.genre];
  const style = STYLE_PRESETS[resolveStyle(input.style)];

  try {
    const { data, model } = await generateJson<CoverV2Brief>({
      system:
        "You are an art director for Amazon KDP book covers. You brief an image model that " +
        "renders the artwork AND the typography itself. Describe type in plain words " +
        "(weight, case, spacing, feel) — never name a font, a foundry, or CSS. " +
        "Never put the book's text into the artwork description. Reply with JSON only.",
      prompt: `Brief one front cover.

Title: "${input.title}"
Subtitle: "${input.subtitle ?? "none"}"
Genre: ${COVER_GENRE_LABELS[input.genre]}
Audience: ${input.audience ?? "general readers"}
Topic: ${input.niche ?? input.title}
Requested mood: ${input.mood ?? "not specified"}

CHOSEN VISUAL STYLE — "${style.label}". This takes priority over the genre defaults:
- Art: ${style.art}
- Type: ${style.type}
- Palette: ${style.palette}${style.avoid ? `\n- Avoid: ${style.avoid}` : ""}

Genre context (use for the subject matter, not the look):
- Typical subject: ${d.look}
- Genre palette: ${d.palette}

Rules:
- Stay inside the chosen visual style. Do not drift toward a different look.
- The artwork must have a clear, well-lit focal point — either one strong subject or a small friendly group (2-4) where the style calls for it. Never an empty or near-black frame.
- Leave a calm, low-detail area where the title will sit.
- The cover must read clearly as a ${COVER_GENRE_LABELS[input.genre]} title at thumbnail size.

Return JSON:
{
  "concept": string,               // one sentence describing the artwork only, no text/words in it
  "composition": string,           // where title, artwork and author sit
  "palette": string[],             // 2-4 colour names, not hex
  "typographyInstruction": string, // weight, case, spacing, feel — no font names
  "titleTreatment": string,        // how prominent the title is
  "authorTreatment": string,       // how the author line is set
  "mood": string
}`,
      temperature: 0.8,
      maxTokens: 600,
      // Reasoning art-director models (e.g. GLM) routinely exceed the 30s default and
      // silently fall back to the template brief, which is what makes covers look
      // plainer than intended. The brief runs once and image generation already takes
      // 20s+, so a longer ceiling here costs nothing in practice.
      timeoutMs: 90_000,
      validate: (raw) => {
        const o = raw as Record<string, unknown>;
        const palette = Array.isArray(o.palette)
          ? o.palette.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 4)
          : [];
        if (palette.length === 0) throw new Error("palette missing");
        return {
          concept: stringField(o, "concept", 400),
          composition: stringField(o, "composition", 300),
          palette: palette.map((p) => p.trim().slice(0, 40)),
          typographyInstruction: stringField(o, "typographyInstruction", 240),
          titleTreatment: stringField(o, "titleTreatment", 200),
          authorTreatment: stringField(o, "authorTreatment", 200),
          mood: stringField(o, "mood", 120),
          model: "pending",
        };
      },
    });
    return { ...data, model };
  } catch {
    return fallbackBrief(input);
  }
}
