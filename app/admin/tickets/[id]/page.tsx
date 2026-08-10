import Link from "next/link";
import { notFound } from "next/navigation";
import { getTicketWithReplies } from "@/lib/support/tickets";
import { TicketThread } from "@/components/support/ticket-thread";
import { TicketAdminPanel } from "@/components/admin/ticket-admin";

export const dynamic = "force-dynamic";

export default async function AdminTicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getTicketWithReplies(id);
  if (!data) notFound();
  const { ticket, replies } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/admin/tickets" className="text-sm text-neutral-500 hover:underline">← All tickets</Link>

      <div>
        <h1 className="text-2xl font-bold">{ticket.subject}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          <span className="capitalize">{ticket.category.replace("_", " ")}</span> · <span className="capitalize">{ticket.priority}</span> priority ·
          status <span className="font-medium">{ticket.status}</span> · opened {new Date(ticket.created_at).toLocaleDateString()}
        </p>
        <Link href={`/admin/users/${ticket.user_id}`} className="text-xs text-neutral-400 hover:underline">View customer →</Link>
      </div>

      <TicketThread replies={replies} />

      <TicketAdminPanel ticketId={ticket.id} currentStatus={ticket.status} />
    </div>
  );
}
