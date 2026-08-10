/**
 * Story Book generation pipeline.
 *
 * Turns a queued storybook job into a stored, downloadable book: insert the
 * books row → build the illustrated interior + cover → upload PDFs → write
 * metadata → mark complete. Mirrors generateAndStoreBook, but for the async,
 * image-heavy story generator (character-consistent picture books).
 */

import { getSupabaseAdminClient } from "../supabase/admin";
import { requireMutationRow } from "../supabase/errors";
import { putBookPdf, bookObjectKey } from "../storage";
import { loadPublishingProfile, profileAuthor } from "../publishing/profile";
import { buildStorybook } from "../generators/story/book";
import {
  STORY_AGE_RANGES,
  STORY_ART_STYLES,
  type StoryAgeRange,
  type StoryArtStyle,
} from "../generators/story/types";

export interface StorybookGenInput {
  idea: string;
  title?: string;
  ageRange?: string;
  artStyle?: string;
  pageCount?: number;
  author?: string;
}

export interface StoredStorybook {
  id: string;
  title: string;
  pageCount: number;
  metadataBy: string;
}

function coerceAge(v: unknown): StoryAgeRange {
  return STORY_AGE_RANGES.includes(v as StoryAgeRange) ? (v as StoryAgeRange) : "3-5";
}
function coerceStyle(v: unknown): StoryArtStyle {
  return STORY_ART_STYLES.includes(v as StoryArtStyle) ? (v as StoryArtStyle) : "watercolor";
}

export async function generateAndStoreStorybook(
  userId: string,
  input: StorybookGenInput,
  opts?: { onProgress?: (step: string, percent: number) => void | Promise<void> }
): Promise<StoredStorybook> {
  const admin = getSupabaseAdminClient();
  const progress = async (step: string, pct: number) => {
    try { await opts?.onProgress?.(step, pct); } catch { /* best-effort */ }
  };

  const idea = (input.idea ?? "").trim();
  if (!idea) throw new Error("Story idea is required");

  const author = input.author ?? profileAuthor(await loadPublishingProfile(userId));
  const ageRange = coerceAge(input.ageRange);
  const artStyle = coerceStyle(input.artStyle);

  await progress("Outline", 5);

  const insertResult = await admin
    .from("books")
    .insert({
      user_id: userId,
      book_type: "storybook",
      theme: idea,
      title: input.title?.trim() || idea.slice(0, 80),
      status: "generating",
      difficulty: ageRange,
      puzzle_count: 0,
      trim_size: "8.5x11",
      word_source: null,
      config: { idea, ageRange, artStyle, author },
    })
    .select("id")
    .single();
  const inserted = requireMutationRow(insertResult, "Create storybook");
  const bookId = inserted.id as string;

  try {
    const result = await buildStorybook(
      { idea, title: input.title, ageRange, artStyle, pageCount: input.pageCount, author },
      opts?.onProgress
    );

    await progress("Upload assets", 90);
    const interiorKey = bookObjectKey(userId, bookId, "interior");
    const coverKey = bookObjectKey(userId, bookId, "cover");
    await putBookPdf(interiorKey, result.interior.pdf);
    await putBookPdf(coverKey, result.cover.pdf);

    const metadataResult = await admin.from("book_metadata").upsert({
      book_id: bookId,
      title: result.plan.title,
      subtitle: result.plan.subtitle,
      description: result.plan.description,
      keywords: result.plan.keywords,
      generated_by: result.plan.generatedBy,
    }).select("book_id").single();
    requireMutationRow(metadataResult, "Save storybook metadata");

    const completeResult = await admin.from("books").update({
      status: "completed",
      page_count: result.pageCount,
      title: result.plan.title,
      interior_key: interiorKey,
      cover_key: coverKey,
      config: { idea, ageRange, artStyle, author, character: result.character.name, generatedBy: result.plan.generatedBy },
      updated_at: new Date().toISOString(),
    }).eq("id", bookId).select("id").maybeSingle();
    requireMutationRow(completeResult, "Complete storybook", "Book");

    return { id: bookId, title: result.plan.title, pageCount: result.pageCount, metadataBy: result.plan.generatedBy };
  } catch (err) {
    const failedResult = await admin.from("books")
      .update({ status: "failed", error: err instanceof Error ? err.message : "Generation failed" })
      .eq("id", bookId)
      .select("id")
      .maybeSingle();
    try {
      requireMutationRow(failedResult, "Mark storybook failed", "Book");
    } catch (statusError) {
      console.error("[storybook] could not persist failed status:", statusError);
    }
    throw err;
  }
}
