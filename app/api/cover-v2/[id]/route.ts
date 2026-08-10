import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getAccountSession } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireMutationRow } from "@/lib/supabase/errors";
import { deleteBytes, isCanonicalCoverVariationObjectKey } from "@/lib/storage";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Delete one of the user's V2 covers.
 *
 * Migration 0021 removed the authenticated owner DELETE policy on `covers` — all
 * artifact writes are service-role only now — so this route is the only way a buyer
 * can remove a cover. Restricted to engine='v2' so the Beta cannot be used to reach
 * covers made by the stable studio.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const rl = rateLimit(`cover-v2-delete:${user.id}`, 30);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  // RLS scopes the read to the owner; engine keeps this endpoint to V2 covers.
  const lookup = await supabase
    .from("covers")
    .select("id, variation_keys, engine")
    .eq("id", id)
    .eq("engine", "v2")
    .maybeSingle();
  if (lookup.error) {
    console.error("[cover-v2] delete lookup failed:", lookup.error);
    return NextResponse.json({ error: "Could not load cover" }, { status: 500 });
  }
  if (!lookup.data) return NextResponse.json({ error: "Cover not found" }, { status: 404 });

  // Only remove objects that match this user's canonical slots — never a key that
  // happens to be stored on the row.
  const keys = Array.isArray(lookup.data.variation_keys) ? (lookup.data.variation_keys as string[]) : [];
  const owned = keys.filter(
    (key, index) => typeof key === "string" && isCanonicalCoverVariationObjectKey(key, user.id, id, index)
  );

  if (owned.length) {
    try {
      await deleteBytes(owned);
    } catch (error) {
      // Storage cleanup is best-effort: an orphaned object is better than leaving a
      // row the buyer cannot get rid of.
      console.error("[cover-v2] storage cleanup failed:", error);
    }
  }

  try {
    const result = await getSupabaseAdminClient()
      .from("covers")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("engine", "v2")
      .select("id")
      .maybeSingle();
    requireMutationRow(result, "Delete cover", "Cover");
  } catch (error) {
    console.error("[cover-v2] delete failed:", error);
    return NextResponse.json({ error: "Could not delete cover" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
