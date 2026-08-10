import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getAccountSession } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireMutationRow } from "@/lib/supabase/errors";
import {
  coverVariationObjectKey,
  deleteBytes,
  getCoverVariationSignedUrl,
  isCanonicalCoverVariationObjectKey,
  isStorageConfigured,
  putBytes,
} from "@/lib/storage";
import { buildCovers, COVER_GENRES, type CoverGenre } from "@/lib/cover";
import { reserve, refund, recordUsage } from "@/lib/billing";
import { assertFeature, billingErrorResponse } from "@/lib/billing/guard";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const TRIMS = ["6x9", "8x10", "8.5x11"] as const;
const TEXT_LIMITS = {
  subtitle: 300,
  author: 200,
  mood: 100,
  artStyle: 100,
  audience: 300,
  niche: 200,
} as const;

function optionalText(body: Record<string, unknown>, field: keyof typeof TEXT_LIMITS): string | undefined {
  const value = body[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length > TEXT_LIMITS[field]) throw new Error(`${field} is too long`);
  return trimmed || undefined;
}

async function bestEffortUsage(
  userId: string,
  cost: number,
  status: "completed" | "failed",
  refId: string | undefined,
  title: string
): Promise<void> {
  try {
    await recordUsage(userId, "cover", cost, status, refId, { topic: title });
  } catch (error) {
    console.error(`[cover] could not record ${status} usage:`, error);
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const account = await getAccountSession(supabase);
  if (account.kind === "unauthenticated") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (account.kind === "unavailable") {
    return NextResponse.json({ error: "Account status is unavailable" }, { status: 503 });
  }
  if (account.kind !== "active") {
    return NextResponse.json({ error: "Account is not active" }, { status: 403 });
  }
  const { user } = account;
  const rl = rateLimit(`cover:${user.id}`, 6);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);
  if (!isStorageConfigured()) return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "Book title is required" }, { status: 400 });
  }
  const title = body.title.trim();
  if (title.length > 300) return NextResponse.json({ error: "Book title is too long" }, { status: 400 });
  if (body.genre !== undefined && !COVER_GENRES.includes(body.genre as CoverGenre)) {
    return NextResponse.json({ error: "Invalid genre" }, { status: 400 });
  }
  if (body.trim !== undefined && !TRIMS.includes(body.trim as (typeof TRIMS)[number])) {
    return NextResponse.json({ error: "Invalid trim size" }, { status: 400 });
  }
  if (body.opportunityScore !== undefined && (
    typeof body.opportunityScore !== "number" ||
    !Number.isFinite(body.opportunityScore) ||
    body.opportunityScore < 0 ||
    body.opportunityScore > 100
  )) {
    return NextResponse.json({ error: "Invalid opportunity score" }, { status: 400 });
  }

  let text: { [K in keyof typeof TEXT_LIMITS]?: string };
  try {
    text = Object.fromEntries(
      (Object.keys(TEXT_LIMITS) as Array<keyof typeof TEXT_LIMITS>).map((field) => [field, optionalText(body, field)])
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid input" }, { status: 400 });
  }

  const genre = (body.genre ?? "business") as CoverGenre;
  const trim = (body.trim ?? "6x9") as string;
  const input = {
    title,
    subtitle: text.subtitle,
    author: text.author,
    genre,
    mood: text.mood,
    artStyle: text.artStyle,
    audience: text.audience,
    niche: text.niche,
    opportunityScore: body.opportunityScore as number | undefined,
    trim,
  };

  const cost = 1;
  try {
    await assertFeature(user.id, "cover");
    await reserve(user.id, cost, "cover");
  } catch (error) {
    const response = billingErrorResponse(error);
    if (response) return response;
    throw error;
  }

  const admin = getSupabaseAdminClient();
  let coverId: string | undefined;
  const uploadedKeys: string[] = [];
  let committed = false;

  try {
    const { brief, concepts } = await buildCovers(input);
    if (concepts.length !== 1) throw new Error("Cover generation returned an invalid variation count");

    const insertResult = await admin
      .from("covers")
      .insert({
        user_id: user.id,
        title,
        subtitle: input.subtitle ?? null,
        author: input.author ?? null,
        book_type: genre,
        genre,
        trim,
        mood: input.mood ?? null,
        art_style: input.artStyle ?? null,
        audience: input.audience ?? null,
        image_prompt: brief.imagePrompt,
        layout: brief.layout,
        typography: brief.typography,
        model: brief.model,
      })
      .select("id")
      .single();
    coverId = (requireMutationRow(insertResult, "Create cover") as { id: string }).id;

    const keys = concepts.map((_, index) => coverVariationObjectKey(user.id, coverId as string, index));
    if (!keys.every((key, index) => isCanonicalCoverVariationObjectKey(key, user.id, coverId as string, index))) {
      throw new Error("Generated a non-canonical cover variation key");
    }

    const conceptMeta = concepts.map((concept) => concept.concept);
    for (let index = 0; index < concepts.length; index++) {
      // Track the intended write first: an upload error can still leave an object
      // behind if storage committed before the response failed.
      uploadedKeys.push(keys[index]);
      await putBytes(keys[index], concepts[index].bytes, "image/png");
    }

    const updateResult = await admin
      .from("covers")
      .update({ variation_keys: keys, concepts: conceptMeta })
      .eq("id", coverId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    requireMutationRow(updateResult, "Commit cover generation", "Cover");
    committed = true;

    await bestEffortUsage(user.id, cost, "completed", coverId, title);
    const urls = await Promise.all(
      keys.map((key, index) => getCoverVariationSignedUrl(key, user.id, coverId as string, index, 600))
    );
    return NextResponse.json({
      id: coverId,
      brief: { layout: brief.layout, typography: brief.typography, model: brief.model },
      variations: keys.map((_, index) => ({
        index,
        url: urls[index],
        score: conceptMeta[index].score,
        layout: conceptMeta[index].layout,
        breakdown: conceptMeta[index].breakdown ?? null,
        visualQuality: conceptMeta[index].visualQuality ?? null,
      })),
    });
  } catch (error) {
    console.error("cover generation failed:", error);
    if (!committed) {
      if (uploadedKeys.length) {
        try {
          await deleteBytes(uploadedKeys);
        } catch (cleanupError) {
          console.error("[cover] storage rollback failed:", cleanupError);
        }
      }
      if (coverId) {
        try {
          const deleteResult = await admin
            .from("covers")
            .delete()
            .eq("id", coverId)
            .eq("user_id", user.id)
            .select("id")
            .maybeSingle();
          requireMutationRow(deleteResult, "Roll back cover row", "Cover");
        } catch (cleanupError) {
          console.error("[cover] row rollback failed:", cleanupError);
        }
      }
      try {
        await refund(user.id, cost, coverId);
      } catch (refundError) {
        console.error("[cover] credit refund failed:", refundError);
      }
      await bestEffortUsage(user.id, cost, "failed", coverId, title);
    }
    return NextResponse.json(
      { error: committed ? "Cover was generated, but its download links are temporarily unavailable." : "Cover generation failed. Please try again." },
      { status: 500 }
    );
  }
}
