import Link from "next/link";
import { listAllTickets } from "@/lib/support/tickets";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  pending: "bg-blue-100 text-blue-700",
  answered: "bg-green-100 text-green-700",
  closed: "bg-neutral-100 text-neutral-400",
};
const PRIORITY_BADGE: Record<string, string> = {
  low: "text-neutral-400",
  normal: "text-neutral-500",
  high: "text-amber-600",
  urgent: "text-red-600 font-semibold",
};

export default async function AdminTicketsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const tickets = await listAllTickets(sp.status);
  const tabs = ["", "open", "pending", "answered", "closed"];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Support Center</h1>
        <p className="mt-1 text-sm text-neutral-600">Answer customer tickets and manage their status.</p>
      </div>

      <div className="flex gap-1">
        {tabs.map((s) => (
          <Link key={s || "all"} href={`/admin/tickets${s ? `?status=${s}` : ""}`}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${(sp.status ?? "") === s ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
            {s || "all"}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Subject</th>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Priority</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {tickets.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No tickets.</td></tr>
            ) : tickets.map((t) => (
              <tr key={t.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/tickets/${t.id}`} className="font-medium text-neutral-900 hover:underline">{t.subject}</Link>
                </td>
                <td className="px-4 py-2.5 text-xs text-neutral-500">
                  {t.user_email ? <Link href={`/admin/users/${t.user_id}`} className="hover:underline">{t.user_email}</Link> : "—"}
                </td>
                <td className="px-4 py-2.5 text-xs capitalize text-neutral-600">{t.category.replace("_", " ")}</td>
                <td className={`px-4 py-2.5 text-xs capitalize ${PRIORITY_BADGE[t.priority] ?? ""}`}>{t.priority}</td>
                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_BADGE[t.status] ?? ""}`}>{t.status}</span></td>
                <td className="px-4 py-2.5 text-xs text-neutral-400">{new Date(t.last_reply_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
