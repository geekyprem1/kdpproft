import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getAccountSession } from "@/lib/supabase/server";
import { getCoverVariationSignedUrl } from "@/lib/storage";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = Number(req.nextUrl.searchParams.get("v") ?? "0");

  const supabase = await createSupabaseServerClient();
  const account = await getAccountSession(supabase);
  if (account.kind === "unauthenticated") {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (account.kind !== "active") {
    return NextResponse.json({ error: "Account is not active" }, { status: 403 });
  }
  const { user } = account;
  const rl = rateLimit(`dl-cover:${user.id}`, 60);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const variation = Number.isInteger(v) && v >= 0 ? v : -1;
  if (variation < 0) return NextResponse.json({ error: "Invalid variation" }, { status: 400 });

  // RLS scopes the cover to the owner.
  const { data: cover } = await supabase.from("covers").select("variation_keys").eq("id", id).single();
  const keys = (cover?.variation_keys as string[] | undefined) ?? [];
  const key = keys[variation];
  if (!key) return NextResponse.json({ error: "Cover not found" }, { status: 404 });

  try {
    return NextResponse.redirect(
      await getCoverVariationSignedUrl(key, user.id, id, variation, 300)
    );
  } catch {
    return NextResponse.json({ error: "Cover not found" }, { status: 404 });
  }
}
