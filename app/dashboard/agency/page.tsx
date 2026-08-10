import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateSubscription } from "@/lib/billing";
import { SetupPending } from "@/components/dashboard/setup-pending";

export const dynamic = "force-dynamic";

export default async function AgencyPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const sub = await getOrCreateSubscription(user.id);
  // Direct entitlement check — only actual Agency buyers land here.
  if (sub.entitlements?.agency !== true) redirect("/dashboard/upgrade");

  return (
    <SetupPending
      title="Agency / Client Edition"
      intro="Thanks for grabbing the Agency Edition. Your premium tools are unlocked, and client workflow features are being set up for your account."
      perks={[
        "Coloring, Premium Cover & Ebook unlocked",
        "Client project workflow (setup in progress)",
        "Priority support for client work",
      ]}
    />
  );
}
