import { NextRequest, NextResponse } from "next/server";
import { isPersistenceNotFound } from "@/lib/supabase/errors";
import { resolveAdmin, adminDeleteBook } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await resolveAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let action = "";
  try {
    action = String((await req.json()).action ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (action === "delete") await adminDeleteBook(admin, id);
    else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin] book action failed:", e);
    if (isPersistenceNotFound(e)) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
