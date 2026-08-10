import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { PLANS, PLAN_ORDER, planKeyFromName } from "@/lib/billing";

export const dynamic = "force-dynamic";

interface BillingRow {
  id: string;
  user_id: string;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
  profiles: { email: string } | { email: string }[] | null;
}

export default async function AdminBillingPage() {
  const admin = getSupabaseAdminClient();
  const [{ data: subs }, { data: events }] = await Promise.all([
    admin.from("subscriptions").select("plan_name, plan_type, status"),
    admin.from("billing_audit_log").select("id, user_id, action, detail, created_at, profiles(email)").order("created_at", { ascending: false }).limit(100),
  ]);

  // Plan distribution + revenue
  const dist: Record<string, { count: number; revenue: number }> = {};
  for (const k of PLAN_ORDER) dist[PLANS[k].name] = { count: 0, revenue: 0 };
  let totalRevenue = 0;
  for (const s of (subs ?? []) as Array<{ plan_name: string; plan_type: string; status: string }>) {
    const name = s.plan_name;
    if (!dist[name]) dist[name] = { count: 0, revenue: 0 };
    dist[name].count += 1;
    if (s.plan_type !== "free" && s.status === "active") {
      const price = PLANS[planKeyFromName(name)]?.price ?? 0;
      dist[name].revenue += price;
      totalRevenue += price;
    }
  }

  const rows = (events ?? []) as unknown as BillingRow[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing Tools</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Plan changes, credit grants and refunds are performed per-user on the{" "}
          <Link href="/admin/users" className="underline">user pages</Link>. This is the platform-wide overview.
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700">Plan Distribution</h2>
          <div className="text-sm font-bold text-neutral-900">${totalRevenue.toLocaleString()} <span className="text-xs font-normal text-neutral-400">total revenue</span></div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PLAN_ORDER.map((k) => {
            const name = PLANS[k].name;
            const d = dist[name] ?? { count: 0, revenue: 0 };
            return (
              <div key={k} className="rounded-lg bg-neutral-50 p-3">
                <div className="text-lg font-bold text-neutral-900">{d.count}</div>
                <div className="truncate text-[10px] text-neutral-400">{name}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700">Recent Billing Activity</h2>
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Detail</th>
                <th className="px-4 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-400">No billing activity.</td></tr>
              ) : rows.map((r) => {
                const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
                return (
                  <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="px-4 py-2 text-xs">
                      <Link href={`/admin/users/${r.user_id}`} className="text-neutral-600 hover:underline">{p?.email ?? r.user_id.slice(0, 8)}</Link>
                    </td>
                    <td className="px-4 py-2 text-xs font-medium capitalize">{r.action}</td>
                    <td className="px-4 py-2 text-xs text-neutral-500">{JSON.stringify(r.detail)}</td>
                    <td className="px-4 py-2 text-xs text-neutral-400">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
