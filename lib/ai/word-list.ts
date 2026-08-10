/**
 * AI word-list generation for arbitrary niches. Returns a clean, deduped pool of
 * uppercase A–Z words sized for a word search grid. Throws if AI is unavailable
 * or the result is unusable — callers fall back to the curated banks.
 */

import { generateJson } from "./provider";
import { isAiConfigured } from "./models";

export interface WordListResult {
  words: string[];
  model: string;
}

function sanitize(raw: string[], maxLen: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of raw) {
    const clean = String(w).toUpperCase().replace(/[^A-Z]/g, "");
    if (clean.length < 3 || clean.length > maxLen) continue;
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

export async function generateWordList(opts: {
  niche: string;
  count?: number;
  maxWordLength?: number;
}): Promise<WordListResult> {
  if (!isAiConfigured()) throw new Error("AI not configured");

  const count = opts.count ?? 30;
  const maxLen = opts.maxWordLength ?? 12;

  const { data, model } = await generateJson<string[]>({
    system:
      "You generate word lists for printable word search puzzle books. Reply with JSON only.",
    prompt: `List ${count + 10} distinct words strongly related to the theme "${opts.niche}".
Rules:
- Single words only (no spaces, hyphens, or punctuation).
- Letters A–Z only, no numbers or accents.
- 3 to ${maxLen} letters each.
- Common, recognizable, family-friendly words on the theme.
Return JSON of the exact shape: {"words": ["WORD1", "WORD2", ...]}`,
    temperature: 0.7,
    maxTokens: 800,
    validate: (raw) => {
      const obj = raw as { words?: unknown };
      if (!obj || !Array.isArray(obj.words)) throw new Error("missing words[]");
      const words = obj.words.filter((w) => typeof w === "string") as string[];
      if (words.length < 8) throw new Error("too few words");
      return words;
    },
  });

  const clean = sanitize(data, maxLen);
  if (clean.length < 8) throw new Error("too few usable words after sanitizing");
  return { words: clean.slice(0, count), model };
}
