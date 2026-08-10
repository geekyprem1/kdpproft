/**
 * Cover V2 prompt assembly — the "text contract".
 *
 * Image models render QUOTED strings far more reliably than described ones, so the
 * exact text is stated literally and everything else is forbidden. Without the
 * prohibitions these models happily invent taglines, series numbers, publisher
 * marks and award badges, all of which make a cover unusable on KDP.
 */

import { COVER_GENRE_LABELS, type CoverGenre } from "../cover/types";
import { resolveStyle, STYLE_PRESETS, type CoverV2Style } from "./styles";
import type { CoverV2Brief, CoverV2TextSpec } from "./types";

/** Repair strategies, in escalating order of how much they simplify the text. */
export type PromptStrategy = "standard" | "simplified" | "title_only";

export interface BuildPromptOptions {
  brief: CoverV2Brief;
  text: CoverV2TextSpec;
  genre: CoverGenre;
  strategy?: PromptStrategy;
  /** Visual style preset — restated in the prompt so the model cannot drift. */
  style?: CoverV2Style;
  /** Book topic — steers subject even when the LLM brief is weak/template. */
  niche?: string;
  /** Target reader — a blunt but reliable genre/mood signal to the image model. */
  audience?: string;
}

/** Collapse whitespace; quotes inside the title would break the contract's quoting. */
function clean(value: string): string {
  return value.replace(/["“”]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Which strings the cover must show for a given strategy. Repairs progressively drop
 * optional text so the model has fewer chances to misspell something.
 */
export function textForStrategy(text: CoverV2TextSpec, strategy: PromptStrategy): CoverV2TextSpec {
  const title = clean(text.title);
  if (strategy === "title_only") return { title };
  if (strategy === "simplified") {
    return { title, author: text.author ? clean(text.author) : undefined };
  }
  return {
    title,
    subtitle: text.subtitle ? clean(text.subtitle) : undefined,
    author: text.author ? clean(text.author) : undefined,
  };
}

/**
 * Artwork with NO text at all — the input to the hybrid fallback.
 *
 * When the model cannot spell the title, we stop asking it to try and let it do the
 * thing it is reliably good at. The V1 HTML typography engine then sets the type over
 * this artwork, which is how V1 has always worked, so the text is perfect by
 * construction. A calm upper area is requested because that is where V1's layouts
 * place the title block.
 */
export function buildArtOnlyPrompt(
  brief: CoverV2Brief,
  genre: CoverGenre,
  style?: CoverV2Style,
  context?: { niche?: string; audience?: string }
): string {
  const preset = STYLE_PRESETS[resolveStyle(style)];
  const niche = context?.niche?.trim();
  const audience = context?.audience?.trim();
  const lines = [
    `Front cover artwork for a ${COVER_GENRE_LABELS[genre]} book.`,
    `Visual style — ${preset.label}: ${preset.art}.`,
    brief.concept,
    `Colour palette: ${brief.palette.join(", ")}.`,
    `Mood: ${brief.mood}.`,
    ...(niche ? [`Subject / topic focus: ${niche}.`] : []),
    ...(audience ? [`For readers of: ${audience} — evoke this genre's mood and subject.`] : []),
    "Keep the upper third calm, simple and low-detail — open sky or a soft colour field.",
    "A clear, well-lit focal point — one strong subject or a small friendly group — with depth. Never an empty or near-black frame.",
    "Leave a clear empty margin along the top and bottom edges and keep the subjects within the central 80% of the height, so nothing is lost when the cover is trimmed.",
  ];
  if (preset.avoid) lines.push(`Avoid: ${preset.avoid}.`);
  lines.push(
    "",
    "ABSOLUTELY NO TEXT. No letters, no words, no numbers, no titles, no captions,",
    "no signatures, no watermarks, no logos, no badges. A purely wordless illustration.",
    "",
    preset.quality
      ? `${preset.quality}. Vertical book cover artwork, sharp focus.`
      : "Vertical book cover artwork, professional retail quality, sharp focus."
  );
  return lines.join("\n");
}

export function buildImagePrompt(opts: BuildPromptOptions): string {
  const strategy = opts.strategy ?? "standard";
  const text = textForStrategy(opts.text, strategy);
  const { brief, genre } = opts;
  const style = STYLE_PRESETS[resolveStyle(opts.style)];

  const lines: string[] = [
    `Front cover artwork for a ${COVER_GENRE_LABELS[genre]} book.`,
    // The style is restated here, not just in the brief: the image model only ever
    // sees this prompt, and without it the look drifts between concepts.
    `Visual style — ${style.label}: ${style.art}.`,
    brief.concept,
    `Composition: ${brief.composition}.`,
    `Colour palette: ${brief.palette.join(", ")}.`,
    `Mood: ${brief.mood}.`,
  ];

  // Inject the topic + audience straight into the image prompt. The LLM brief
  // already digests these, but restating them here keeps genre/subject steering
  // even when the brief falls back to the template — a reliable signal the image
  // model reads directly.
  const niche = opts.niche?.trim();
  const audience = opts.audience?.trim();
  if (niche) lines.push(`Subject / topic focus: ${niche}.`);
  if (audience) lines.push(`For readers of: ${audience} — evoke this genre's mood and subject.`);

  // Negative guidance is what keeps one style from bleeding into another; only the
  // enriched presets carry it.
  if (style.avoid) lines.push(`Avoid: ${style.avoid}.`);

  lines.push(
    "",
    "Render EXACTLY the following text on the cover, spelled exactly as written, and no other words:",
    `Title: "${text.title}"`
  );

  if (text.subtitle) lines.push(`Subtitle: "${text.subtitle}"`);
  if (text.author) lines.push(`Author: "${text.author}"`);

  lines.push(
    "",
    `Typography: ${style.type}. ${brief.typographyInstruction}.`,
    `Title: ${brief.titleTreatment}.`
  );
  if (text.author) lines.push(`Author line: ${brief.authorTreatment}.`);

  lines.push(
    "",
    "Text rules, all mandatory:",
    "- Spell every word exactly as given above.",
    "- Do not add taglines, series names, volume numbers, publisher names, award badges, barcodes, prices or URLs.",
    "- Do not invent words, repeat lines, or leave partial letters.",
    "- Keep all text fully inside the cover with clear margins; never crop a letter at an edge.",
    "- All text must be high-contrast and legible when shrunk to a small thumbnail.",
    // Print safe-zone: covers are trimmed, and a fixed-ratio model (e.g. 2:3) fitted
    // to a taller trim loses a strip top and bottom. Keeping the subject and text
    // within the central area means that trim removes only empty margin, not art.
    "- Leave a clear empty margin along the top and bottom edges. Keep the main subject, the title and the author within the central 80% of the height, well away from the very top and bottom, so nothing important is lost if the cover is trimmed.",
    "",
    style.quality
      ? `${style.quality}. Vertical book cover, sharp focus, no watermark, no signature.`
      : "Vertical book cover, professional retail quality, sharp focus, no watermark, no signature."
  );

  // The repair passes lean harder on legibility, because that is what failed.
  if (strategy !== "standard") {
    lines.push(
      "Priority: perfectly spelled, clearly separated capital letters. Prefer simple, bold lettering over decorative styling."
    );
  }

  return lines.join("\n");
}
