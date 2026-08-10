/**
 * Alternative title generator — 10 title ideas for the niche/audience.
 * OpenRouter with a heuristic fallback.
 */

import { generateJson } from "../ai/provider";
import { isAiConfigured } from "../ai/models";

export interface TitleInput {
  title: string;
  bookType: string;
  theme?: string;
  audience?: string;
}

function fallback(input: TitleInput): string[] {
  const t = input.theme || input.title;
  const aud = input.audience || "All Ages";
  const base = [
    `The Big ${t} Book`,
    `${t}: A Fun Collection`,
    `${t} for ${aud}`,
    `Ultimate ${t} Edition`,
    `${t} Made Easy`,
    `The ${t} Companion`,
    `Hours of ${t} Fun`,
    `${t} Deluxe`,
    `My ${t} Book`,
    `${t} Volume 1`,
  ];
  return base.slice(0, 10);
}

export async function generateAltTitles(input: TitleInput): Promise<string[]> {
  if (!isAiConfigured()) return fallback(input);
  try {
    const { data } = await generateJson<{ titles: unknown }>({
      system: "You are a book title copywriter. Reply with JSON only.",
      prompt: `Suggest 10 alternative, catchy KDP titles for a ${input.bookType} book.
Current title: "${input.title}". Theme: ${input.theme ?? "n/a"}. Audience: ${input.audience ?? "general"}.
Return JSON: {"titles": ["...", ...]}`,
      temperature: 0.9,
      maxTokens: 500,
      validate: (raw) => {
        const o = raw as { titles?: unknown };
        if (!Array.isArray(o.titles) || o.titles.length === 0) throw new Error("titles");
        return o as { titles: unknown };
      },
    });
    const titles = (data.titles as unknown[]).filter((t) => typeof t === "string").map((t) => (t as string).trim());
    return titles.length ? titles.slice(0, 10) : fallback(input);
  } catch {
    return fallback(input);
  }
}
