/**
 * Cover V2 spelling verification.
 *
 * This is the part that makes V2 sellable. Text-capable models are good, not
 * perfect — independent testing puts the best at roughly 90% text accuracy, which
 * across a 3-concept set means a meaningful chance that one cover carries a typo.
 * A KDP cover with a misspelled title is worthless, so every cover is read back by
 * a vision model and compared to the exact strings the buyer asked for.
 */

import type { CoverV2TextSpec, CoverV2Verification } from "./types";

/** Upper-case, strip punctuation, collapse whitespace — compare words, not styling. */
export function normalizeText(value: string): string {
  return value
    .toUpperCase()
    .replace(/[’']/g, "")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance, used only to describe *how* a title was wrong. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Is `phrase` present in `haystack`, allowing for a near-miss? Returns the exact
 * match state so the caller can distinguish "absent" from "misspelled" — a typo
 * is worth retrying, a blank cover is worth retrying differently.
 */
function findPhrase(haystack: string, phrase: string): "exact" | "typo" | "missing" {
  if (!phrase) return "exact";
  if (haystack.includes(phrase)) return "exact";

  const words = haystack.split(" ");
  const target = phrase.split(" ");
  if (target.length > words.length) {
    return editDistance(haystack, phrase) <= Math.max(1, Math.floor(phrase.length * 0.15)) ? "typo" : "missing";
  }

  // Slide a window the same length as the phrase and look for a close variant.
  const tolerance = Math.max(1, Math.floor(phrase.length * 0.15));
  for (let i = 0; i + target.length <= words.length; i++) {
    const window = words.slice(i, i + target.length).join(" ");
    if (window === phrase) return "exact";
    if (editDistance(window, phrase) <= tolerance) return "typo";
  }
  return "missing";
}

/**
 * Compare a transcription against the requested text.
 *
 * The title is mandatory. The author is required when supplied, because a missing
 * author line is a design failure a buyer would have to pay to fix. The subtitle is
 * treated as optional: models frequently drop or restyle it, and unlike the title
 * that does not make the cover unusable.
 */
export function compareTranscription(
  transcribed: string,
  spec: CoverV2TextSpec
): CoverV2Verification {
  const said = normalizeText(transcribed);
  if (!said) {
    return { ok: false, transcribed, reason: "No text was readable on the cover" };
  }

  const title = normalizeText(spec.title);
  const titleState = findPhrase(said, title);
  if (titleState === "missing") {
    return { ok: false, transcribed, reason: `The title "${spec.title}" is not on the cover` };
  }
  if (titleState === "typo") {
    return { ok: false, transcribed, reason: `The title is misspelled — the cover reads "${transcribed.trim()}"` };
  }

  if (spec.author?.trim()) {
    const authorState = findPhrase(said, normalizeText(spec.author));
    if (authorState !== "exact") {
      return {
        ok: false,
        transcribed,
        reason: authorState === "typo"
          ? `The author name is misspelled — the cover reads "${transcribed.trim()}"`
          : `The author name "${spec.author}" is not on the cover`,
      };
    }
  }

  return { ok: true, transcribed };
}
