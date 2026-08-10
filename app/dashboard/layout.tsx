import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAdmin } from "@/lib/admin";
import { getOrCreateSubscription } from "@/lib/billing";
import { DashboardNav } from "@/components/dashboard/nav";
import { SignOutButton } from "@/components/dashboard/sign-out-button";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, { title: string; body: string }> = {
  suspended: { title: "Your account is suspended", body: "Access to KDP Profit Machine is temporarily paused. Contact support if you believe this is a mistake." },
  banned: { title: "Your account has been banned", body: "Access to KDP Profit Machine has been revoked. Contact support if you believe this is a mistake." },
  deleted: { title: "Your account has been closed", body: "This account is no longer active." },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let email: string | null = null;
  let userId: string | null = null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) redirect("/login");
    email = user.email ?? null;
    userId = user.id;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) redirect("/login?error=account_unavailable");
    const status = profile.account_status as string;

    if (status !== "active") {
      const copy = STATUS_COPY[status] ?? STATUS_COPY.banned;
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream px-6 text-center">
          <h1 className="text-2xl font-bold text-neutral-900">{copy.title}</h1>
          <p className="mt-2 max-w-md text-sm text-neutral-600">{copy.body}</p>
          <SignOutButton className="mt-6 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700" />
        </div>
      );
    }
  } catch {
    redirect("/login");
  }

  const admin = await resolveAdmin();

  // Manually-fulfilled add-ons (Agency/Reseller) surface in the sidebar only when
  // the buyer actually owns the entitlement.
  let hasAgency = false;
  let hasReseller = false;
  if (userId) {
    try {
      const sub = await getOrCreateSubscription(userId);
      hasAgency = sub.entitlements?.agency === true;
      hasReseller = Boolean(sub.entitlements?.reseller);
    } catch {
      /* non-fatal: nav just won't show the add-on links */
    }
  }

  return (
    <div className="flex min-h-screen bg-brand-cream">
      <Suspense fallback={<div className="w-60 shrink-0 bg-black" />}>
        <DashboardNav
          email={email}
          isAdmin={Boolean(admin)}
          hasAgency={hasAgency}
          hasReseller={hasReseller}
        />
      </Suspense>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
