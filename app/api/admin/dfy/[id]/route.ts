import { NextRequest, NextResponse } from "next/server";
import { resolveAdmin, logAdminAction } from "@/lib/admin";
import { deleteDfyAsset, setDfyAssetPublished } from "@/lib/dfy/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH — toggle publish state. Body: { published: boolean }. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await resolveAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const published = Boolean(body.published);

  try {
    await setDfyAssetPublished(id, published);
    await logAdminAction(admin, "dfy_publish", { targetType: "dfy_asset", targetId: id, detail: { published } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/dfy] publish toggle failed:", e);
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }
}

/** DELETE — remove an asset and its stored file. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await resolveAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  try {
    await deleteDfyAsset(id);
    await logAdminAction(admin, "dfy_delete", { targetType: "dfy_asset", targetId: id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/dfy] delete failed:", e);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
}
