/**
 * KDP keyword generator — 7 primary keywords + 20 long-tail ideas.
 * OpenRouter (Gemini → DeepSeek); falls back to heuristics from book metadata.
 */

import { generateJson } from "../ai/provider";
import { isAiConfigured } from "../ai/models";

export interface KeywordSet {
  primary: string[];
  longTail: string[];
}

export interface KeywordInput {
  title: string;
  bookType: string;
  theme?: string;
  audience?: string;
  existing?: string[];
}

const clean = (arr: unknown, n: number): string[] => {
  if (!Array.isArray(arr)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of arr) {
    if (typeof v !== "string") continue;
    const k = v.trim().toLowerCase().replace(/\s+/g, " ");
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out.slice(0, n);
};

function fallback(input: KeywordInput): KeywordSet {
  const t = (input.theme || input.title).toLowerCase();
  const aud = input.audience || "adults";
  const typeWord =
    input.bookType === "coloring" ? "coloring book"
    : input.bookType === "ebook" ? "guide"
    : input.bookType === "word_search" ? "word search"
    : input.bookType === "maze" ? "maze book"
    : input.bookType === "sudoku" ? "sudoku" : "puzzle book";
  const primary = clean(
    [
      `${t} ${typeWord}`,
      `${typeWord} for ${aud}`,
      `${t} ${typeWord} for ${aud}`,
      `large print ${typeWord}`,
      `${t} activity book`,
      `${typeWord} gift`,
      input.existing?.[0] ?? `${t} book`,
    ],
    7
  );
  const longTail = clean(
    Array.from({ length: 20 }, (_, i) => `${t} ${typeWord} ${["for kids", "for beginners", "easy", "large print", "gift idea", "for seniors", "fun", "themed", "collection", "volume 1"][i % 10]}`),
    20
  );
  return { primary, longTail };
}

export async function generateKeywords(input: KeywordInput): Promise<KeywordSet> {
  if (!isAiConfigured()) return fallback(input);
  try {
    const { data } = await generateJson<{ primary: unknown; longTail: unknown }>({
      system: "You are an Amazon KDP keyword expert. Reply with JSON only.",
      prompt: `Book: "${input.title}" (${input.bookType}). Theme: ${input.theme ?? "n/a"}. Audience: ${input.audience ?? "general"}.
Give Amazon KDP search keywords shoppers actually type.
Return JSON: {"primary": [7 short high-value keyword phrases], "longTail": [20 longer, specific keyword phrases]}`,
      temperature: 0.7,
      maxTokens: 800,
      validate: (raw) => {
        const o = raw as { primary?: unknown; longTail?: unknown };
        if (!Array.isArray(o.primary) || !Array.isArray(o.longTail)) throw new Error("shape");
        return o as { primary: unknown; longTail: unknown };
      },
    });
    const primary = clean(data.primary, 7);
    const longTail = clean(data.longTail, 20);
    const fb = fallback(input);
    return {
      primary: primary.length ? primary : fb.primary,
      longTail: longTail.length ? longTail : fb.longTail,
    };
  } catch {
    return fallback(input);
  }
}
