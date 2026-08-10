import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { putBytes, isStorageConfigured } from "@/lib/storage";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain"]);

/** Upload a single support attachment; returns { name, key, size } for the ticket. */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const rl = rateLimit(`support-upload:${user.id}`, 10);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);
  if (!isStorageConfigured()) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "attachment";
  const key = `support/${user.id}/${randomUUID()}-${safeName}`;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    await putBytes(key, bytes, file.type);
    return NextResponse.json({ name: safeName, key, size: file.size });
  } catch (e) {
    console.error("[support] upload failed:", e);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
