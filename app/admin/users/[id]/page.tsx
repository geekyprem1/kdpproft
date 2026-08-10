import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserDetail, resolveAdmin } from "@/lib/admin";
import { PLAN_ORDER, PLANS } from "@/lib/billing";
import { grantables } from "@/lib/offers";
import { UserActions } from "@/components/admin/user-actions";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, admin] = await Promise.all([getUserDetail(id), resolveAdmin()]);
  if (!detail) notFound();
  const { profile, subscription, bookCount, jobCount, recentBooks, recentUsage, recentBilling, tickets } = detail;

  const plans = PLAN_ORDER.map((k) => ({ key: k, name: PLANS[k].name }));
  const offers = grantables().map((g) => ({ key: g.key, label: g.label }));
  const entitlements = subscription?.entitlements ?? {};
  const ownedEntitlements = Object.entries(entitlements)
    .filter(([, v]) => v)
    .map(([k, v]) => (v === true ? k : `${k}:${v}`));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/users" className="text-sm text-neutral-500 hover:underline">← All users</Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{profile.email}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {profile.full_name ?? "No name"} · joined {new Date(profile.created_at).toLocaleDateString()} · role {profile.role}
          </p>
          {profile.account_status !== "active" && (
            <p className="mt-1 text-sm font-medium text-amber-700">
              Status: {profile.account_status}{profile.status_reason ? ` — ${profile.status_reason}` : ""}
            </p>
          )}
        </div>
      </div>

      {/* Snapshot (view-as, read-only) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Plan", value: subscription?.plan_name ?? "—" },
          { label: "Credits", value: (subscription?.credits_remaining ?? 0).toLocaleString() },
          { label: "Books", value: bookCount.toLocaleString() },
          { label: "Jobs", value: jobCount.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{s.label}</div>
            <div className="mt-1 text-lg font-bold text-neutral-900">{s.value}</div>
          </div>
        ))}
      </div>

      {ownedEntitlements.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Entitlements</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ownedEntitlements.map((e) => (
              <span key={e} className="rounded-full bg-[#2563EB]/15 px-2.5 py-0.5 text-xs font-medium text-[#8a6d1f]">
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      <UserActions
        userId={profile.id}
        accountStatus={profile.account_status}
        isSuperAdmin={admin?.role === "super_admin"}
        plans={plans}
        offers={offers}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent books */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Recent Books</h2>
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            {recentBooks.length === 0 ? <p className="p-4 text-sm text-neutral-400">No books.</p> : (
              <ul className="divide-y divide-neutral-100">
                {recentBooks.map((b) => (
                  <li key={b.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="truncate">{b.title}</span>
                    <span className="text-xs text-neutral-400">{b.book_type} · {b.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Tickets */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Support Tickets</h2>
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            {tickets.length === 0 ? <p className="p-4 text-sm text-neutral-400">No tickets.</p> : (
              <ul className="divide-y divide-neutral-100">
                {tickets.map((t) => (
                  <li key={t.id} className="px-4 py-2.5 text-sm">
                    <Link href={`/admin/tickets/${t.id}`} className="hover:underline">{t.subject}</Link>
                    <span className="ml-2 text-xs text-neutral-400">{t.status} · {t.priority}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Usage */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Recent Usage</h2>
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            {recentUsage.length === 0 ? <p className="p-4 text-sm text-neutral-400">No usage.</p> : (
              <ul className="divide-y divide-neutral-100">
                {recentUsage.map((u) => (
                  <li key={u.id} className="flex items-center justify-between px-4 py-2 text-xs">
                    <span>{u.action}</span>
                    <span className="text-neutral-400">{u.credits} cr · {u.status} · {new Date(u.created_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Billing audit */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Billing History</h2>
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm">
            {recentBilling.length === 0 ? <p className="p-4 text-sm text-neutral-400">No billing events.</p> : (
              <ul className="divide-y divide-neutral-100">
                {recentBilling.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-4 py-2 text-xs">
                    <span>{r.action}</span>
                    <span className="text-neutral-400">{new Date(r.created_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
