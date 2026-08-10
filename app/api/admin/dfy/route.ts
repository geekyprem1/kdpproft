import { NextRequest, NextResponse } from "next/server";
import { resolveAdmin, logAdminAction } from "@/lib/admin";
import { isStorageConfigured } from "@/lib/storage";
import { createDfyAsset, listDfyAssets, DFY_CATEGORIES } from "@/lib/dfy/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — book interiors/bundles
const ALLOWED = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "image/png",
  "image/jpeg",
]);

/** GET — list all DFY assets (admin). */
export async function GET() {
  const admin = await resolveAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const assets = await listDfyAssets();
    return NextResponse.json({ assets });
  } catch (e) {
    console.error("[admin/dfy] list failed:", e);
    return NextResponse.json({ error: "Could not list assets." }, { status: 500 });
  }
}

/** POST (multipart) — upload a new DFY asset (admin). */
export async function POST(req: NextRequest) {
  const admin = await resolveAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isStorageConfigured()) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim();
  const category = String(form.get("category") ?? "general").trim();
  const description = String(form.get("description") ?? "").trim();
  const file = form.get("file");

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!(DFY_CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "File is empty" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const asset = await createDfyAsset({
      title,
      category,
      description: description || undefined,
      fileName: file.name,
      contentType: file.type,
      bytes,
      createdBy: admin.userId,
    });
    await logAdminAction(admin, "dfy_upload", {
      targetType: "dfy_asset",
      targetId: asset.id,
      detail: { title, category, size: asset.file_size },
    });
    return NextResponse.json({ asset });
  } catch (e) {
    console.error("[admin/dfy] upload failed:", e);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
