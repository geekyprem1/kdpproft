import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBytes } from "@/lib/storage";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "book";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const rl = rateLimit(`export-bundle:${user.id}`, 20);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  // RLS scopes both to the owner.
  const { data: bundle } = await supabase.from("bundles").select("id, topic").eq("id", id).single();
  if (!bundle) return NextResponse.json({ error: "Bundle not found" }, { status: 404 });

  const { data: books } = await supabase
    .from("books")
    .select("title, book_type, interior_key, cover_key, status")
    .eq("bundle_id", id)
    .order("created_at", { ascending: true });

  const completed = (books ?? []).filter((b) => b.status === "completed" && b.interior_key);
  if (completed.length === 0) return NextResponse.json({ error: "No completed books to export" }, { status: 409 });

  const zip = new JSZip();
  for (let i = 0; i < completed.length; i++) {
    const b = completed[i];
    const folder = `${i + 1}-${slug(b.title)}`;
    if (b.interior_key) zip.file(`${folder}/interior.pdf`, await getBytes(b.interior_key));
    if (b.cover_key) zip.file(`${folder}/cover.pdf`, await getBytes(b.cover_key));
  }

  const bytes = await zip.generateAsync({ type: "uint8array" });
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="bundle-${slug(bundle.topic)}.zip"`,
      // Bundles package already-completed book PDFs → safe to cache the ZIP.
      "Cache-Control": "private, max-age=300",
    },
  });
}
