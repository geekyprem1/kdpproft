import Link from "next/link";
import { listUsers, resolveAdmin } from "@/lib/admin";
import { grantables } from "@/lib/offers";
import { CreateUserForm } from "@/components/admin/create-user-form";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    suspended: "bg-amber-100 text-amber-800",
    banned: "bg-red-100 text-red-800",
    deleted: "bg-neutral-200 text-neutral-600",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? "bg-neutral-100"}`}>{status}</span>;
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const [users, admin] = await Promise.all([listUsers({ search: sp.q, status: sp.status }), resolveAdmin()]);
  const offers = grantables().map((g) => ({ key: g.key, label: g.label }));

  const statusTabs = ["", "active", "suspended", "banned", "deleted"];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="mt-1 text-sm text-neutral-600">View, manage plans, credits, and account status.</p>
      </div>

      <CreateUserForm isSuperAdmin={admin?.role === "super_admin"} offers={offers} />

      <div className="flex flex-wrap items-center gap-3">
        <form className="flex gap-2">
          <input
            name="q" defaultValue={sp.q ?? ""} placeholder="Search by email…"
            className="w-64 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
          />
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <button className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white">Search</button>
        </form>
        <div className="flex gap-1">
          {statusTabs.map((s) => (
            <Link
              key={s || "all"}
              href={`/admin/users${s ? `?status=${s}` : ""}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                (sp.status ?? "") === s ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {s || "all"}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Plan</th>
              <th className="px-4 py-2 font-medium">Credits</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No users found.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-2.5">
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-neutral-900 hover:underline">{u.email}</Link>
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{u.plan_name ?? "—"}</td>
                <td className="px-4 py-2.5 text-neutral-600">{u.credits_remaining ?? 0}</td>
                <td className="px-4 py-2.5"><StatusBadge status={u.account_status} /></td>
                <td className="px-4 py-2.5">
                  {u.role !== "user"
                    ? <span className="rounded-full bg-[#2563EB]/15 px-2 py-0.5 text-[10px] font-semibold text-[#9a7d2f]">{u.role}</span>
                    : <span className="text-xs text-neutral-400">user</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-neutral-400">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
