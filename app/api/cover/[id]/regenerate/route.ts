import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getAccountSession } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireMutationRow } from "@/lib/supabase/errors";
import {
  getBytes,
  getCoverVariationSignedUrl,
  isCanonicalCoverVariationObjectKey,
  putBytes,
} from "@/lib/storage";
import {
  buildOneConcept,
  CONCEPT_LAYOUTS,
  COVER_GENRES,
  type CoverGenre,
  type ConceptLayout,
} from "@/lib/cover";
import { reserve, refund, recordUsage } from "@/lib/billing";
import { assertFeature, billingErrorResponse } from "@/lib/billing/guard";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
interface Concept { layout: ConceptLayout; seed: number; score: number; breakdown?: unknown; visualQuality?: unknown; bg_source?: string }

async function bestEffortUsage(
  userId: string,
  cost: number,
  status: "completed" | "failed",
  refId: string,
  title: string
): Promise<void> {
  try {
    await recordUsage(userId, "cover", cost, status, refId, { topic: title });
  } catch (error) {
    console.error(`[cover-regen] could not record ${status} usage:`, error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid cover id" }, { status: 400 });

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
  const rl = rateLimit(`cover-regen:${user.id}`, 10);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid body");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.index !== "number" || !Number.isInteger(body.index) || body.index < 0) {
    return NextResponse.json({ error: "Invalid concept index" }, { status: 400 });
  }
  const index = body.index;

  const coverResult = await supabase
    .from("covers")
    .select("id, title, subtitle, author, genre, mood, art_style, audience, trim, image_prompt, layout, typography, model, concepts, variation_keys")
    .eq("id", id)
    .maybeSingle();
  if (coverResult.error) {
    console.error("[cover-regen] cover lookup failed:", coverResult.error);
    return NextResponse.json({ error: "Could not load cover" }, { status: 500 });
  }
  const cover = coverResult.data;
  if (!cover) return NextResponse.json({ error: "Cover not found" }, { status: 404 });

  const concepts = Array.isArray(cover.concepts) ? (cover.concepts as unknown as Concept[]) : [];
  const keys = Array.isArray(cover.variation_keys) ? cover.variation_keys as string[] : [];
  if (index >= keys.length || index >= concepts.length) {
    return NextResponse.json({ error: "Invalid concept index" }, { status: 400 });
  }
  const key = keys[index];
  if (typeof key !== "string" || !isCanonicalCoverVariationObjectKey(key, user.id, id, index)) {
    return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  }
  const layout = concepts[index]?.layout;
  if (!CONCEPT_LAYOUTS.includes(layout)) {
    return NextResponse.json({ error: "Cover concept is invalid" }, { status: 409 });
  }
  if (typeof cover.title !== "string" || !cover.title.trim() || !COVER_GENRES.includes(cover.genre as CoverGenre)) {
    return NextResponse.json({ error: "Cover data is invalid" }, { status: 409 });
  }

  const input = {
    title: cover.title,
    subtitle: typeof cover.subtitle === "string" ? cover.subtitle : undefined,
    author: typeof cover.author === "string" ? cover.author : undefined,
    genre: cover.genre as CoverGenre,
    mood: typeof cover.mood === "string" ? cover.mood : undefined,
    artStyle: typeof cover.art_style === "string" ? cover.art_style : undefined,
    audience: typeof cover.audience === "string" ? cover.audience : undefined,
    trim: typeof cover.trim === "string" ? cover.trim : "6x9",
  };
  const brief = {
    imagePrompt: typeof cover.image_prompt === "string" ? cover.image_prompt : input.title,
    accentColor: "#c9a84c",
    layout: typeof cover.layout === "string" ? cover.layout : "",
    typography: typeof cover.typography === "string" ? cover.typography : "",
    model: typeof cover.model === "string" ? cover.model : "template",
  };

  const cost = 1;
  try {
    await assertFeature(user.id, "cover");
    await reserve(user.id, cost, "cover_regen", id);
  } catch (error) {
    const response = billingErrorResponse(error);
    if (response) return response;
    throw error;
  }

  let originalBytes: Uint8Array | undefined;
  let uploaded = false;
  let committed = false;
  try {
    originalBytes = await getBytes(key);
    const seed = Date.now() % 1_000_000;
    const built = await buildOneConcept(input, brief, layout, seed, index);
    // Treat the overwrite as attempted before awaiting it: a failed response
    // does not prove storage left the original object untouched.
    uploaded = true;
    await putBytes(key, built.bytes, "image/png");

    const nextConcepts = [...concepts];
    nextConcepts[index] = built.concept;
    const updateResult = await getSupabaseAdminClient()
      .from("covers")
      .update({ concepts: nextConcepts })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    requireMutationRow(updateResult, "Commit regenerated cover", "Cover");
    committed = true;

    await bestEffortUsage(user.id, cost, "completed", id, input.title);
    const url = await getCoverVariationSignedUrl(key, user.id, id, index, 600);
    return NextResponse.json({
      index,
      url,
      score: built.concept.score,
      layout,
      breakdown: built.concept.breakdown ?? null,
      visualQuality: built.concept.visualQuality ?? null,
      bg_source: built.concept.bg_source ?? null,
    });
  } catch (error) {
    console.error("regenerate failed:", error);
    if (!committed) {
      if (uploaded && originalBytes) {
        try {
          await putBytes(key, originalBytes, "image/png");
        } catch (restoreError) {
          console.error("[cover-regen] object restore failed:", restoreError);
        }
      }
      try {
        await refund(user.id, cost, id);
      } catch (refundError) {
        console.error("[cover-regen] credit refund failed:", refundError);
      }
      await bestEffortUsage(user.id, cost, "failed", id, input.title);
    }
    return NextResponse.json(
      { error: committed ? "Cover was regenerated, but its download link is temporarily unavailable." : "Regenerate failed. Please try again." },
      { status: 500 }
    );
  }
}
