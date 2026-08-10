import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export default async function AdminAuditPage() {
  const { data } = await getSupabaseAdminClient()
    .from("admin_audit_log")
    .select("id, actor_email, action, target_type, target_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as AuditRow[];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="mt-1 text-sm text-neutral-600">Every privileged admin action, newest first.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2 font-medium">Admin</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Target</th>
              <th className="px-4 py-2 font-medium">Detail</th>
              <th className="px-4 py-2 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-400">No admin actions yet.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-2 text-xs text-neutral-600">{r.actor_email ?? "—"}</td>
                <td className="px-4 py-2 text-xs font-medium capitalize">{r.action.replace(/_/g, " ")}</td>
                <td className="px-4 py-2 text-xs text-neutral-500">{r.target_type ? `${r.target_type}:${(r.target_id ?? "").slice(0, 8)}` : "—"}</td>
                <td className="px-4 py-2 text-xs text-neutral-400">{JSON.stringify(r.detail)}</td>
                <td className="px-4 py-2 text-xs text-neutral-400">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
