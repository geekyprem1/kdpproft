/**
 * Coloring-book prompt building.
 *
 * FLUX Schnell has no negative-prompt parameter, so all the "what NOT to do"
 * constraints (no shading, no grayscale, white background) are baked directly
 * into the positive prompt. Subjects per page are generated via OpenRouter
 * (falls back to simple numbered subjects when AI is unavailable).
 */

import { generateJson } from "../../ai/provider";
import { isAiConfigured } from "../../ai/models";
import type { ColoringAgeGroup, ColoringStyle } from "./types";

const DETAIL: Record<ColoringAgeGroup, string> = {
  toddlers: "very simple, large bold shapes, minimal detail, extra-thick outlines",
  kids: "simple, friendly, clear shapes, bold outlines, easy to color",
  adults: "moderately detailed, clean intricate linework",
};

const STYLE_HINT: Record<ColoringStyle, string> = {
  simple: "minimalist",
  cute: "cute kawaii cartoon",
  detailed: "detailed illustrative",
  // Adult coloring niches — intricate, symmetrical, pattern-rich line art.
  mandala: "intricate symmetrical mandala, ornate concentric zentangle patterns, highly detailed adult coloring",
  floral: "intricate decorative floral, flowing botanical patterns, detailed adult coloring",
  geometric: "intricate geometric pattern, tessellated symmetrical shapes, detailed adult coloring",
};

/** Build the full FLUX prompt for a single coloring page. */
export function buildColoringPrompt(opts: {
  subject: string;
  ageGroup: ColoringAgeGroup;
  style: ColoringStyle;
}): string {
  return [
    `${STYLE_HINT[opts.style]} black and white coloring book line art of ${opts.subject}`,
    "clean bold black outlines, thick uniform line weight",
    DETAIL[opts.ageGroup],
    "pure white background, no background scenery clutter",
    "no shading, no grayscale, no gradients, no color, no fill",
    "high contrast pure line drawing, printable, centered composition",
    "no text, no watermark, no signature",
  ].join(", ");
}

/**
 * Generate `count` distinct coloring-page subjects for a theme. Uses OpenRouter
 * when configured; otherwise falls back to numbered generic subjects.
 */
export async function buildSubjects(opts: {
  theme: string;
  ageGroup: ColoringAgeGroup;
  count: number;
}): Promise<string[]> {
  const fallback = (): string[] =>
    Array.from({ length: opts.count }, (_, i) => `a ${opts.theme} scene (${i + 1})`);

  if (!isAiConfigured()) return fallback();

  try {
    const { data } = await generateJson<string[]>({
      system: "You design coloring books. Reply with JSON only.",
      prompt: `List ${opts.count} distinct, single-subject ideas for coloring-book pages on the theme "${opts.theme}", suitable for ${opts.ageGroup}.
Each item is a short noun phrase describing ONE clear subject to draw (e.g. "a friendly T-Rex with big teeth"). No numbering, no scenes with lots of small objects.
Return JSON: {"subjects": ["...", "..."]}`,
      temperature: 0.9,
      maxTokens: 1200,
      validate: (raw) => {
        const o = raw as { subjects?: unknown };
        const list = Array.isArray(o?.subjects) ? o.subjects : Array.isArray(raw) ? raw : null;
        if (!list) throw new Error("no subjects");
        const subjects = list.filter((s) => typeof s === "string" && s.trim()).map((s) => (s as string).trim());
        if (subjects.length < Math.min(5, opts.count)) throw new Error("too few subjects");
        return subjects as string[];
      },
    });
    // pad/truncate to exactly `count`
    const out = data.slice(0, opts.count);
    while (out.length < opts.count) out.push(`a ${opts.theme} scene (${out.length + 1})`);
    return out;
  } catch {
    return fallback();
  }
}
