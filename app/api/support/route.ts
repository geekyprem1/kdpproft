import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createTicket, TICKET_CATEGORIES, TICKET_PRIORITIES,
  type TicketCategory, type TicketPriority, type Attachment,
} from "@/lib/support/tickets";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const rl = rateLimit(`support:${user.id}`, 5);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const subject = String(body.subject ?? "").trim();
  const message = String(body.body ?? "").trim();
  const category = String(body.category ?? "general") as TicketCategory;
  const priority = String(body.priority ?? "normal") as TicketPriority;
  const attachments = Array.isArray(body.attachments) ? (body.attachments as Attachment[]) : [];

  if (!subject) return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });
  if (!TICKET_CATEGORIES.includes(category)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  if (!TICKET_PRIORITIES.includes(priority)) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });

  try {
    const id = await createTicket(user.id, { subject, category, priority, body: message, attachments });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[support] create ticket failed:", e);
    return NextResponse.json({ error: "Could not create ticket." }, { status: 500 });
  }
}
