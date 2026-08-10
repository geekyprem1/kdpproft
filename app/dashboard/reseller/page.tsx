import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateSubscription } from "@/lib/billing";
import { SetupPending } from "@/components/dashboard/setup-pending";

export const dynamic = "force-dynamic";

export default async function ResellerPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const sub = await getOrCreateSubscription(user.id);
  // Direct entitlement check — only actual Reseller buyers land here (any truthy value).
  if (!sub.entitlements?.reseller) redirect("/dashboard/upgrade");

  return (
    <SetupPending
      title="Reseller / Whitelabel Edition"
      intro="Thanks for grabbing the Reseller Edition. Your white-label branding and reseller client accounts are being configured for your account."
      perks={[
        "White-label branding on exports (setup in progress)",
        "Reseller client accounts (setup in progress)",
        "Priority reseller support",
      ]}
    />
  );
}
