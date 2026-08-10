import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { analyzeTopic } from "@/lib/ai";
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
  const rl = rateLimit(`opportunity:${user.id}`, 15);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) return NextResponse.json({ error: "Topic is required" }, { status: 400 });

  const cost = 1; // Market Intelligence™
  try {
    await assertFeature(user.id, "market_intelligence");
    await reserve(user.id, cost, "niche");
  } catch (e) {
    const r = billingErrorResponse(e);
    if (r) return r;
    throw e;
  }

  try {
    const analysis = await analyzeTopic({
      topic,
      audience: typeof body.audience === "string" ? body.audience : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      country: typeof body.country === "string" ? body.country : undefined,
    });
    await recordUsage(user.id, "market_intelligence", cost, "completed", undefined, { topic });
    return NextResponse.json(analysis);
  } catch (err) {
    await refund(user.id, cost);
    await recordUsage(user.id, "market_intelligence", cost, "failed", undefined, { topic });
    console.error("opportunity failed:", err);
    return NextResponse.json({ error: "Analysis failed." }, { status: 500 });
  }
}
