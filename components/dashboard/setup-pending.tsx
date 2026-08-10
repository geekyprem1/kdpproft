import Link from "next/link";
import { LifeBuoy, CheckCircle2 } from "lucide-react";

/**
 * Interim screen for add-ons that are fulfilled manually (Agency, Reseller).
 * The buyer owns the offer; setup is completed by the support team.
 */
export function SetupPending({
  title,
  intro,
  perks,
}: {
  title: string;
  intro: string;
  perks: string[];
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Purchase confirmed
        </div>

        <p className="mt-4 text-sm leading-relaxed text-neutral-600">{intro}</p>

        {perks.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {perks.map((p) => (
              <li key={p} className="grid grid-cols-[18px_1fr] gap-2 text-sm text-neutral-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-5">
          <h2 className="text-sm font-semibold text-neutral-800">Next step: contact our support team</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Your account setup is completed manually so we can configure it correctly for you.
            Open a support ticket and our team will get you set up — usually within 24 hours.
          </p>
          <Link
            href="/dashboard/support"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-neutral-700"
          >
            <LifeBuoy className="h-4 w-4" /> Contact support team
          </Link>
        </div>
      </div>
    </div>
  );
}
