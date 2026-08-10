import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const price = Number(body.defaultPrice);
  // Updated via the user-scoped client (RLS "own profile update").
  const { error } = await supabase
    .from("profiles")
    .update({
      author_name: str(body.authorName) || null,
      pen_name: str(body.penName) || null,
      publisher_name: str(body.publisherName) || null,
      language: str(body.language) || "English",
      trim_size: str(body.trimSize) || "8.5x11",
      default_price: Number.isFinite(price) && price > 0 ? price : null,
      ai_disclosure: str(body.aiDisclosure) || null,
      copyright_notice: str(body.copyrightNotice) || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: "Could not save settings" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
