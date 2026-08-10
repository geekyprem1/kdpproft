import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPersistenceNotFound } from "@/lib/supabase/errors";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { addReply, type Attachment } from "@/lib/support/tickets";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A user replies to their own ticket. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const rl = rateLimit(`support-reply:${user.id}`, 20);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { id: ticketId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = String(body.body ?? "").trim();
  const attachments = Array.isArray(body.attachments) ? (body.attachments as Attachment[]) : [];
  if (!text) return NextResponse.json({ error: "Reply cannot be empty" }, { status: 400 });

  // Ownership check.
  const { data: ticket, error: ticketError } = await getSupabaseAdminClient()
    .from("support_tickets")
    .select("user_id, status")
    .eq("id", ticketId)
    .single();
  if (ticketError) {
    console.error("[support] ticket lookup failed:", ticketError);
    if (ticketError.code === "PGRST116") {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not load ticket." }, { status: 500 });
  }
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (ticket.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (ticket.status === "closed") return NextResponse.json({ error: "This ticket is closed." }, { status: 400 });

  try {
    await addReply(ticketId, user.id, "user", text, attachments);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[support] reply failed:", e);
    if (isPersistenceNotFound(e)) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not post reply." }, { status: 500 });
  }
}
