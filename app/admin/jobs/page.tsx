import Link from "next/link";
import { listJobs } from "@/lib/admin";
import { RowActions } from "@/components/admin/row-actions";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = {
  queued: "bg-neutral-100 text-neutral-600",
  processing: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-amber-100 text-amber-700",
  cancelled: "bg-neutral-100 text-neutral-400",
};

export default async function AdminJobsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const jobs = await listJobs({ status: sp.status });
  const tabs = ["", "queued", "processing", "failed", "completed", "cancelled"];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Job Monitoring</h1>
        <p className="mt-1 text-sm text-neutral-600">Track and recover background generation jobs.</p>
      </div>

      <div className="flex gap-1">
        {tabs.map((s) => (
          <Link key={s || "all"} href={`/admin/jobs${s ? `?status=${s}` : ""}`}
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
              <th className="px-4 py-2 font-medium">Progress</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-400">No jobs.</td></tr>
            ) : jobs.map((j) => (
              <tr key={j.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{j.title ?? "Untitled"}</div>
                  {j.error_message && <div className="text-[10px] text-amber-600">{j.error_message}</div>}
                </td>
                <td className="px-4 py-2.5 text-xs text-neutral-500">
                  {j.user_email ? <Link href={`/admin/users/${j.user_id}`} className="hover:underline">{j.user_email}</Link> : "—"}
                </td>
                <td className="px-4 py-2.5 text-neutral-600">{j.job_type}</td>
                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${BADGE[j.status] ?? ""}`}>{j.status}</span></td>
                <td className="px-4 py-2.5 text-xs text-neutral-500">{j.progress}%</td>
                <td className="px-4 py-2.5">
                  <RowActions
                    endpoint={`/api/admin/jobs/${j.id}`}
                    actions={[
                      { action: "retry", label: "Retry" },
                      { action: "delete", label: "Delete", danger: true, confirm: "Delete this job?" },
                    ]}
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
