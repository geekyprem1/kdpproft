import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listMyTickets } from "@/lib/support/tickets";
import { NewTicket } from "@/components/support/new-ticket";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  pending: "bg-blue-100 text-blue-700",
  answered: "bg-green-100 text-green-700",
  closed: "bg-neutral-100 text-neutral-400",
};

export default async function SupportPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const tickets = user ? await listMyTickets(user.id) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="mt-1 text-sm text-neutral-600">Get help from the KDP Mafia team. We typically reply within a day.</p>
        </div>
      </div>

      <NewTicket />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Your Tickets</h2>
        {tickets.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
            No tickets yet. Open one above if you need help.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white shadow-sm">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/dashboard/support/${t.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{t.subject}</div>
                    <div className="text-xs capitalize text-neutral-400">{t.category.replace("_", " ")} · {new Date(t.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[t.status] ?? ""}`}>{t.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
