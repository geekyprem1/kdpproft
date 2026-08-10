import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateSubscription, hasEntitlement } from "@/lib/billing";
import { signDfyDownload } from "@/lib/dfy/assets";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Return a short-lived signed download URL for a DFY asset. Gated by the
 * `dfy_assets` entitlement (Unlimited owners pass too). Payment/fulfilment is
 * manual — an admin grants the DFY offer, which sets this entitlement.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rl = rateLimit(`dfy-download:${user.id}`, 30);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const sub = await getOrCreateSubscription(user.id);
  if (!hasEntitlement(sub.entitlements, "dfy_assets")) {
    return NextResponse.json(
      { error: "The Done-For-You Edition is required to download this asset.", upgrade: true, offer: "dfy" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const assetId = typeof body.assetId === "string" ? body.assetId : "";
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });

  try {
    const signed = await signDfyDownload(assetId);
    if (!signed) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    return NextResponse.json(signed);
  } catch (e) {
    console.error("[dfy] download sign failed:", e);
    return NextResponse.json({ error: "Could not prepare download." }, { status: 500 });
  }
}
