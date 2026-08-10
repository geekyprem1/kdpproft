import Link from "next/link";
import { listBooks } from "@/lib/admin";
import { RowActions } from "@/components/admin/row-actions";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  generating: "bg-blue-100 text-blue-700",
  failed: "bg-amber-100 text-amber-700",
};

export default async function AdminBooksPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const books = await listBooks({ status: sp.status });
  const tabs = ["", "completed", "generating", "failed"];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Book Monitoring</h1>
        <p className="mt-1 text-sm text-neutral-600">View all generated books and remove problematic ones.</p>
      </div>

      <div className="flex gap-1">
        {tabs.map((s) => (
          <Link key={s || "all"} href={`/admin/books${s ? `?status=${s}` : ""}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${(sp.status ?? "") === s ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}>
            {s || "all"}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">User</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {books.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No books.</td></tr>
            ) : books.map((b) => (
              <tr key={b.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-2.5 font-medium">{b.title}</td>
                <td className="px-4 py-2.5 text-xs text-neutral-500">
                  {b.user_email ? <Link href={`/admin/users/${b.user_id}`} className="hover:underline">{b.user_email}</Link> : "—"}
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{b.book_type}</td>
                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${BADGE[b.status] ?? "bg-neutral-100"}`}>{b.status}</span></td>
                <td className="px-4 py-2.5 text-xs text-neutral-400">{new Date(b.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-2.5">
                  <RowActions
                    endpoint={`/api/admin/books/${b.id}`}
                    actions={[{ action: "delete", label: "Delete", danger: true, confirm: "Delete this book and its files? This cannot be undone." }]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
