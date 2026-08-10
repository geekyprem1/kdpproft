import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateTitleVariations, isAiConfigured } from "@/lib/ai";
import { reserve, refund, recordUsage } from "@/lib/billing";
import { assertFeature, billingErrorResponse } from "@/lib/billing/guard";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const rl = rateLimit(`title-optimizer:${user.id}`, 15);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "Title Optimizer needs OpenRouter — set OPENROUTER_API_KEY on the server." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "Working title is required" }, { status: 400 });

  const input = {
    title,
    subtitle: typeof body.subtitle === "string" ? body.subtitle.trim() : undefined,
    niche: typeof body.niche === "string" ? body.niche.trim() : undefined,
    audience: typeof body.audience === "string" ? body.audience.trim() : undefined,
    genre: typeof body.genre === "string" ? body.genre.trim() : undefined,
  };

  const cost = 1; // Title Optimizer
  try {
    await assertFeature(user.id, "title_optimizer");
    await reserve(user.id, cost, "title_optimizer");
  } catch (e) {
    const r = billingErrorResponse(e);
    if (r) return r;
    throw e;
  }

  try {
    const { variations, model } = await generateTitleVariations(input);
    await recordUsage(user.id, "title_optimizer", cost, "completed", undefined, { title });
    return NextResponse.json({ variations, model });
  } catch (err) {
    await refund(user.id, cost);
    await recordUsage(user.id, "title_optimizer", cost, "failed", undefined, { title });
    console.error("title optimizer failed:", err);
    return NextResponse.json(
      { error: "Optimization failed. Please try again." },
      { status: 500 }
    );
  }
}
