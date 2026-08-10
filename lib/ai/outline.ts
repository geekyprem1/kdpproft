/**
 * Ebook outline generator. Produces an editable, structured chapter list.
 */

import { generateJson } from "./provider";
import { isAiConfigured } from "./models";

export interface OutlineChapter {
  title: string;
  summary: string;
}

export interface EbookOutline {
  bookTitle: string;
  chapters: OutlineChapter[];
  model: string;
}

export interface OutlineInput {
  topic: string;
  audience?: string;
  tone?: string;
  chapterCount: number;
}

function fallback(input: OutlineInput): EbookOutline {
  const n = input.chapterCount;
  return {
    bookTitle: input.topic,
    chapters: Array.from({ length: n }, (_, i) => ({
      title: `Chapter ${i + 1}`,
      summary: `Key ideas about ${input.topic} (part ${i + 1}).`,
    })),
    model: "fallback",
  };
}

export async function generateOutline(input: OutlineInput): Promise<EbookOutline> {
  if (!isAiConfigured()) return fallback(input);
  const audience = input.audience?.trim() || "general readers";
  const tone = input.tone?.trim() || "friendly";

  try {
    const { data, model } = await generateJson<{ bookTitle: unknown; chapters: unknown }>({
      system: "You are a non-fiction book editor. Reply with JSON only.",
      prompt: `Create an outline for a practical non-fiction ebook.
Topic: "${input.topic}". Audience: ${audience}. Tone: ${tone}.
Produce exactly ${input.chapterCount} chapters that flow logically (intro → core → application → wrap-up), each distinct (no overlap).
Return JSON:
{"bookTitle": string, "chapters": [{"title": string, "summary": "1-2 sentences on what the chapter covers"}]}`,
      temperature: 0.7,
      maxTokens: 1500,
      timeoutMs: 90_000,
      validate: (raw) => {
        const o = raw as { bookTitle?: unknown; chapters?: unknown };
        if (!Array.isArray(o.chapters) || o.chapters.length === 0) throw new Error("no chapters");
        return o as { bookTitle: unknown; chapters: unknown };
      },
    });

    const chapters: OutlineChapter[] = (data.chapters as Array<Record<string, unknown>>)
      .map((c) => ({
        title: typeof c.title === "string" ? c.title.trim() : "",
        summary: typeof c.summary === "string" ? c.summary.trim() : "",
      }))
      .filter((c) => c.title)
      .slice(0, input.chapterCount);

    while (chapters.length < input.chapterCount) {
      chapters.push({ title: `Chapter ${chapters.length + 1}`, summary: "" });
    }

    return {
      bookTitle: typeof data.bookTitle === "string" && data.bookTitle.trim() ? data.bookTitle.trim() : input.topic,
      chapters,
      model,
    };
  } catch {
    return fallback(input);
  }
}
