/**
 * V2 cover brief builder. Uses title, subtitle, audience, niche, genre, and
 * opportunity score to produce richer, concept-specific AI image prompts.
 * Each concept gets a DIFFERENT prompt so the three concepts feel genuinely distinct.
 *
 * Genre enforcement: character-required genres (kids, puzzle) append a hard constraint
 * to every prompt so FLUX Schnell always produces compliant imagery.
 */

import { generateJson } from "../ai/provider";
import { isAiConfigured } from "../ai/models";
import {
  COVER_GENRE_LABELS,
  GENRE_PRIORITY,
  type CoverBrief,
  type CoverInput,
  type ConceptLayout,
  type LayoutPriority,
} from "./types";

interface GenreProfile {
  mood: string;
  palette: string;
  motif: string;
  designLanguage: string;
  accentColor: string;
  /** Appended verbatim to EVERY image prompt for this genre. Null for genres without hard constraints. */
  hardConstraint: string | null;
  /** Quality suffix for the FLUX prompt (replaces generic "professional book cover photography quality"). */
  promptQuality: string;
}

const GENRE_PROFILE: Record<string, GenreProfile> = {
  business: {
    mood: "confident, authoritative, premium",
    palette: "deep navy, charcoal, gold accents",
    motif: "geometric abstraction, city skylines, upward trajectories, clean corporate shapes",
    designLanguage: "clean bold sans-serif, strong title dominance, restrained white space",
    accentColor: "#c9a84c",
    hardConstraint:
      "The frame MUST contain one clear, well-lit focal subject with visible detail and depth — for example a modern skyline at golden hour, a striking architectural detail, or a premium material texture with light falling across it. At least three distinct tonal values must be visible, with gold or warm highlights lifting the deep navy base. NOT an almost-black empty frame. NOT a flat gradient with a tiny motif floating in dead space. NOT abstract noise.",
    promptQuality: "premium professional book cover photography quality, rich contrast, crisp detail",
  },
  self_help: {
    mood: "hopeful, uplifting, warm, transformational",
    palette: "warm amber, sunrise gold, soft teal",
    motif: "open roads, sunrise over mountains, blooming nature, person breaking free",
    designLanguage: "professional typography, high contrast, motivational energy",
    accentColor: "#e67e22",
    hardConstraint:
      "The frame MUST contain one clear, warmly lit focal subject with real depth — a sunrise horizon, an open road, a mountain ridge, or blooming nature catching the light. Bright, hopeful exposure with at least three distinct tonal values. NOT a dark, murky or empty frame. NOT a flat gradient with a tiny motif in dead space.",
    promptQuality: "premium professional book cover photography quality, warm natural light, crisp detail",
  },
  puzzle: {
    mood: "energetic, playful, bright, fun",
    palette: "electric blue, bright yellow, vivid contrast",
    motif: "bold geometric puzzle pieces, brain icons, activity-book energy, pop art patterns",
    designLanguage: "large playful titles, uppercase, bright saturated colors, strong border elements",
    accentColor: "#f39c12",
    hardConstraint: "A large, bold, instantly recognizable puzzle/game visual element dominates the frame (roughly 65–80%) — big puzzle pieces, a brain, a maze or game icon, up-close and unmistakable at thumbnail size. Bright bold illustration with multiple saturated primary colors (red, yellow, blue, green). Fun activity-book energy. NOT a tiny motif in empty space. NOT monochromatic. NOT dark or moody. NOT abstract-only.",
    promptQuality: "bold colorful activity book cover illustration quality",
  },
  kids: {
    mood: "cheerful, friendly, magical, safe",
    palette: "rainbow bright, soft pastels, high contrast",
    motif: "cute animal characters, cartoon landscapes, playful adventure scenes, friendly creatures",
    designLanguage: "rounded friendly typography, strong visual hierarchy, bold color blocking",
    accentColor: "#9b59b6",
    hardConstraint: "ONE cute cartoon animal character MUST be the large, dominant hero of the cover — it occupies roughly 65–80% of the frame, centered and up-close, like the best-selling children's picture books. Big, expressive, friendly face that is instantly recognizable even at thumbnail size. The character's FULL FACE and head must be completely visible and NEVER cropped or cut off at any edge. Bright rainbow colors: grass green, sky blue, sunshine yellow, warm orange. Children's book illustration style. NOT a tiny character in a wide scene. NOT abstract. NOT geometric shapes only. NOT a gradient-only background without a character.",
    promptQuality: "children's book illustration quality, vibrant cartoon artwork, large highly detailed cute animal character filling the frame",
  },
  coloring: {
    mood: "calm, creative, inviting, gentle",
    palette: "soft pastels, white space, gentle hues",
    motif: "intricate floral patterns, mandala-inspired art, nature scenes with detailed outlines",
    designLanguage: "bold outlined typography, light airy feel, lots of breathing room",
    accentColor: "#1abc9c",
    hardConstraint: "Multiple distinct colors visible: soft pastels with variety. NOT monochromatic. Include at least 4 distinct color tones. Gentle artistic feel with visible detail.",
    promptQuality: "coloring book cover art quality, soft pastel illustration",
  },
  fiction: {
    mood: "atmospheric, cinematic, mysterious, evocative",
    palette: "deep shadows, dramatic contrasts, moody tones",
    motif: "cinematic dramatic landscapes, silhouettes against dramatic skies, atmospheric fog and light",
    designLanguage: "cinematic typography, large impact title, dramatic atmosphere",
    accentColor: "#c0392b",
    hardConstraint: null,
    promptQuality: "cinematic professional book cover photography quality",
  },
};

/**
 * V4 image direction — driven by the genre's LayoutPriority, not just the concept.
 *
 * For character/artwork genres the subject must DOMINATE (60–80% of the frame) and stay
 * recognizable at thumbnail size — only a calm top strip (~20%) is reserved for the title,
 * so the artwork is never reduced to a strip behind a giant text band. Per-concept variety
 * comes from framing/staging, not from shrinking the subject. For typography genres the
 * artwork stays atmospheric and secondary, leaving a large calm zone for a dominant title.
 */
function imageDirection(priority: LayoutPriority, layout: ConceptLayout): string {
  if (priority === "typography") {
    // "Supporting" must not become "empty": a near-black, featureless field reads as a
    // broken cover and scores badly on thumbnail visibility and commercial appeal. The
    // artwork stays secondary to the title but must still carry a real, lit subject.
    const base =
      "Clean, professional SUPPORTING artwork that is secondary to the typography but still visually rich and clearly readable at thumbnail size. There MUST be one recognisable, well-lit focal subject with depth and dimension — never an empty, flat, near-black frame. Use confident directional lighting, visible highlights, and at least three distinct tones so the image reads as a premium photograph or render. Keep the upper ~40% comparatively calm and low-detail for a dominant title block, but keep it lit and textured rather than pure black.";
    const perLayout: Record<ConceptLayout, string> = {
      fullImage: "Cinematic full-bleed environment with real depth and atmosphere; the middle and lower portions carry a strong, well-lit focal subject while the top stays calmer.",
      typographyFirst: "One bold, elegant focal object or material texture in the lower two-thirds, richly lit against a clean graduated field so the title block still clearly leads.",
      modernCommercial: "A single striking, well-lit focal object centred in the lower two-thirds, with a clean graduated field above it for a solid title band.",
    };
    return `${base} ${perLayout[layout]}`;
  }

  // character / artwork: the subject is the hero and dominates the cover.
  const subject = priority === "character" ? "hero character" : "signature theme element";
  const base =
    `The ${subject} is the HERO of the cover and DOMINATES it — occupying roughly 65–80% of the frame, large, up-close, centered, and instantly recognizable even when shrunk to a 120px thumbnail. Full face/subject completely visible and NEVER cropped at any edge. Reserve ONLY a calm, simple, low-detail TOP STRIP (upper ~20%: open sky or soft color field) for a title — nothing important there. Do NOT shrink the subject into a small element inside a wide empty scene. This must look like a top-selling Amazon cover, not a generic AI layout.`;
  const perLayout: Record<ConceptLayout, string> = {
    fullImage: "Cinematic, premium staging: rich environment around the large subject, warm depth and lighting. The subject fills the frame.",
    typographyFirst: "Bright, clean, high-contrast staging on a simple background so the large subject pops at thumbnail size — maximum clarity.",
    modernCommercial: "Dynamic, polished bestseller staging: confident pose/angle, bold saturated color, the large subject front-and-center.",
  };
  return `${base} ${perLayout[layout]}`;
}

function fallbackBrief(input: CoverInput, layout: ConceptLayout): CoverBrief {
  const gp = GENRE_PROFILE[input.genre] ?? GENRE_PROFILE.business;
  const priority = GENRE_PRIORITY[input.genre] ?? "typography";
  const direction = imageDirection(priority, layout);
  const audienceStr = input.audience ? `audience: ${input.audience}` : "";
  const nicheStr = input.niche ? `niche: ${input.niche}` : "";
  const context = [audienceStr, nicheStr].filter(Boolean).join(", ");
  const basePrompt = `${gp.motif}, ${gp.mood} mood, ${gp.palette}, ${direction}, vertical book cover composition, ${gp.promptQuality}, no text, no letters, no words. ${context}`;
  const imagePrompt = gp.hardConstraint
    ? `${basePrompt} ${gp.hardConstraint}`
    : basePrompt;
  return {
    imagePrompt,
    accentColor: gp.accentColor,
    layout: "Title prominent, subtitle below, author at the bottom.",
    typography: `${gp.designLanguage}. Strong display title, clean subtitle, understated author line.`,
    model: "template",
  };
}

/**
 * Generate a SINGLE concept's image prompt — each concept gets a distinct AI call
 * so the three outputs are genuinely different compositions.
 */
export async function generateConceptBrief(
  input: CoverInput,
  layout: ConceptLayout
): Promise<CoverBrief> {
  const gp = GENRE_PROFILE[input.genre] ?? GENRE_PROFILE.business;
  if (!isAiConfigured()) return fallbackBrief(input, layout);

  const priority = GENRE_PRIORITY[input.genre] ?? "typography";
  const direction = imageDirection(priority, layout);

  const opportunityCtx = input.opportunityScore
    ? `Opportunity score: ${input.opportunityScore}/100 — this book has strong market demand.`
    : "";

  const constraintNote = gp.hardConstraint
    ? `\nCRITICAL genre requirement: ${gp.hardConstraint}`
    : "";

  const systemPrompt = gp.hardConstraint
    ? `You are an expert Amazon KDP book cover art director. You create image prompts that result in covers competitive with top-selling books. Reply with JSON only. Never include text, letters, or words in image prompts.\n\nCRITICAL: This is a ${COVER_GENRE_LABELS[input.genre]} cover. ${gp.hardConstraint} This requirement is non-negotiable — every prompt you write MUST satisfy it.`
    : `You are an expert Amazon KDP book cover art director. You create image prompts that result in covers competitive with top-selling books. Reply with JSON only. Never include text, letters, or words in image prompts.`;

  try {
    const { data, model } = await generateJson<{
      imagePrompt: unknown;
      accentColor: unknown;
      typography: unknown;
    }>({
      system: systemPrompt,
      prompt: `Create a cover image brief for this specific layout concept: "${layout}".

Book details:
- Title: "${input.title}"
- Subtitle: "${input.subtitle ?? "none"}"
- Genre: ${COVER_GENRE_LABELS[input.genre]}
- Audience: ${input.audience ?? "general"}
- Niche/topic: ${input.niche ?? input.title}
- Mood: ${input.mood ?? gp.mood}
${opportunityCtx}

Genre design language: ${gp.designLanguage}
Genre palette: ${gp.palette}
Genre motif: ${gp.motif}${constraintNote}

Layout concept direction: ${direction}

Return JSON:
{
  "imagePrompt": string,  // Vivid, specific 2-3 sentence prompt for BACKGROUND ARTWORK ONLY. No text. No letters. Vertical book cover. ${gp.promptQuality}. Reference the specific mood, visual motif and palette for this genre. Make it unique to THIS layout concept.${gp.hardConstraint ? " MUST satisfy the genre character requirement stated above." : ""}
  "accentColor": string,  // Best hex color for text/design accents on this cover (e.g. "#c9a84c")
  "typography": string    // 1 sentence on font and text treatment for this specific concept
}`,
      temperature: 0.8,
      maxTokens: 600,
      validate: (raw) => {
        const o = raw as Record<string, unknown>;
        if (typeof o.imagePrompt !== "string" || !o.imagePrompt.trim()) throw new Error("imagePrompt missing");
        return o as { imagePrompt: unknown; accentColor: unknown; typography: unknown };
      },
    });

    // Always append the hard constraint to the final FLUX prompt so it can never be omitted
    const basePrompt = `${(data.imagePrompt as string).trim()}, no text, no letters, no words, no title, ${gp.promptQuality}`;
    const imagePrompt = gp.hardConstraint
      ? `${basePrompt}. ${gp.hardConstraint}`
      : basePrompt;

    return {
      imagePrompt,
      accentColor: typeof data.accentColor === "string" && /^#[0-9a-f]{6}$/i.test(data.accentColor)
        ? data.accentColor
        : gp.accentColor,
      layout: direction,
      typography: typeof data.typography === "string" ? data.typography.trim() : gp.designLanguage,
      model,
    };
  } catch {
    return fallbackBrief(input, layout);
  }
}

/** Shared brief for the cover record (uses the first concept's brief). */
export async function generateCoverBrief(input: CoverInput): Promise<CoverBrief> {
  return generateConceptBrief(input, "fullImage");
}
