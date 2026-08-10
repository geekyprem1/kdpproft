import { NextRequest, NextResponse } from "next/server";
import { resolveAdmin, logAdminAction } from "@/lib/admin";
import { isPersistenceNotFound } from "@/lib/supabase/errors";
import { addReply, setTicketStatus, TICKET_STATUSES, type TicketStatus } from "@/lib/support/tickets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await resolveAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: ticketId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const action = String(body.action ?? "");

  try {
    if (action === "reply") {
      const text = String(body.body ?? "").trim();
      if (!text) return NextResponse.json({ error: "Reply cannot be empty" }, { status: 400 });
      await addReply(ticketId, admin.userId, "admin", text);
      await logAdminAction(admin, "ticket_reply", { targetType: "ticket", targetId: ticketId });
    } else if (action === "status") {
      const status = String(body.status ?? "") as TicketStatus;
      if (!TICKET_STATUSES.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      await setTicketStatus(ticketId, status);
      await logAdminAction(admin, "ticket_status", { targetType: "ticket", targetId: ticketId, detail: { status } });
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin] ticket action failed:", e);
    if (isPersistenceNotFound(e)) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Action failed." }, { status: 500 });
  }
}
