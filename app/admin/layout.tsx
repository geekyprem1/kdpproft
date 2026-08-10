import { requireAdmin } from "@/lib/admin";
import { AdminNav } from "@/components/admin/admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Redirects non-admins to /dashboard. Applies env-allowlist bootstrap.
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <AdminNav email={admin.email} role={admin.role} />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
