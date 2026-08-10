/**
 * Ebook chapter writer + rewrite/expand/shorten.
 *
 * Voice-locked (consistent tone + audience across chapters) and outline-locked
 * (each chapter told what the others cover) to avoid drift and repetition — the
 * ebook analog of character consistency.
 */

import { generateText } from "./provider";
import { isAiConfigured } from "./models";

export function wordCount(md: string): number {
  return (md.trim().match(/\S+/g) || []).length;
}

export interface WriteChapterInput {
  bookTitle: string;
  topic: string;
  audience: string;
  tone: string;
  chapterTitle: string;
  chapterSummary: string;
  index: number; // 1-based
  total: number;
  otherTitles: string[];
  targetWords: number; // for this chapter
}

const voiceSystem = (tone: string, audience: string) =>
  `You are a professional non-fiction author writing in a consistent ${tone} voice for ${audience}. ` +
  `Write clean Markdown: short paragraphs, '## ' subheadings, and '- ' bullet lists where useful. ` +
  `Be concrete and practical, no fluff or repetition, no meta commentary, do not restate the chapter title as an H1.`;

export async function writeChapter(input: WriteChapterInput): Promise<string> {
  if (!isAiConfigured()) {
    return `## ${input.chapterTitle}\n\n_(AI not configured — placeholder chapter for "${input.topic}".)_`;
  }
  const { text } = await generateText({
    system: voiceSystem(input.tone, input.audience),
    prompt: `Book: "${input.bookTitle}" (about ${input.topic}).
This is Chapter ${input.index} of ${input.total}: "${input.chapterTitle}".
What it should cover: ${input.chapterSummary || "(use your judgment)"}.
Other chapters (do NOT cover their material): ${input.otherTitles.join("; ")}.
Write the chapter body in Markdown, about ${input.targetWords} words. Start directly with the content (or a '## ' subheading), not the chapter title.`,
    temperature: 0.75,
    maxTokens: Math.min(8000, Math.round(input.targetWords * 2.2)),
    // Long-form generation runs in a background job. Some models (e.g. deepseek)
    // take 40–100s+ for a single chapter, so give a wide budget to avoid aborts.
    timeoutMs: 180_000,
  });
  return text.trim();
}

export type RewriteAction = "rewrite" | "expand" | "shorten";

export interface RewriteChapterInput {
  bookTitle: string;
  topic: string;
  audience: string;
  tone: string;
  chapterTitle: string;
  current: string;
  action: RewriteAction;
}

export async function rewriteChapter(input: RewriteChapterInput): Promise<string> {
  if (!isAiConfigured()) return input.current;
  const instruction =
    input.action === "expand"
      ? "Expand it with more depth, examples, and actionable detail (roughly 1.5× longer)."
      : input.action === "shorten"
        ? "Tighten it to be more concise while keeping all key points (roughly 0.7× length)."
        : "Rewrite it to be clearer, more engaging, and better structured, keeping the same scope.";

  const { text } = await generateText({
    system: voiceSystem(input.tone, input.audience),
    prompt: `Book: "${input.bookTitle}" (about ${input.topic}). Chapter: "${input.chapterTitle}".
${instruction}
Keep clean Markdown ('## ' subheadings, '- ' bullets). Return ONLY the revised chapter body.

--- CURRENT CHAPTER ---
${input.current}`,
    temperature: 0.7,
    maxTokens: 8000,
    timeoutMs: 180_000,
  });
  return text.trim();
}
