import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateSubscription } from "@/lib/billing";
import { UPSELL_OFFERS, type Offer } from "@/lib/offers";

export const dynamic = "force-dynamic";

const GOLD = "#2563EB";

function OfferCard({ offer }: { offer: Offer }) {
  const variants = offer.variants ?? [
    { label: "", price: offer.price, credits: offer.credits, checkoutUrl: offer.checkoutUrl },
  ];
  const buyable = variants.some((v) => v.checkoutUrl);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0c] text-white">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <span className="font-mono text-[11px] uppercase tracking-widest text-white/40">
          {offer.position}
        </span>
        {offer.featureReady ? (
          <span className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            Available now
          </span>
        ) : (
          <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Launching soon
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 py-5">
        <h3 className="text-lg font-bold">{offer.name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-white/45">{offer.tagline}</p>

        <ul className="mt-4 flex flex-col gap-2">
          {offer.features.map((f) => (
            <li key={f} className="grid grid-cols-[16px_1fr] gap-2 text-sm text-white/60">
              <span className="mt-0.5" style={{ color: GOLD }}>
                ✓
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex-1" />

        <div className="mt-4 flex flex-col gap-2">
          {variants.map((v) => {
            const label = v.label ? `Get ${v.label} — $${v.price}` : `Get it — $${v.price}`;
            const meta = `${v.credits > 0 ? `${v.credits.toLocaleString()} credits` : "no credits"} · one-time`;
            return v.checkoutUrl ? (
              <a
                key={v.label || "single"}
                href={v.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg px-4 py-3 text-center text-sm font-bold text-white transition-colors"
                style={{ backgroundColor: GOLD }}
              >
                {label}
                <span className="mt-0.5 block text-[11px] font-normal text-white/70">{meta}</span>
              </a>
            ) : (
              <div
                key={v.label || "single"}
                className="block cursor-not-allowed rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-center text-sm font-semibold text-white/40"
              >
                {v.label ? `${v.label} — $${v.price}` : `$${v.price}`}
                <span className="mt-0.5 block text-[11px] font-normal text-white/25">
                  Checkout link coming soon
                </span>
              </div>
            );
          })}
        </div>
        {!buyable && (
          <p className="mt-2 text-center text-[11px] text-white/25">
            This offer isn&apos;t open for purchase yet.
          </p>
        )}
      </div>
    </div>
  );
}

export default async function UpgradePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const sub = await getOrCreateSubscription(user.id);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Upgrade &amp; Add-ons</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Stack more power onto your account — one-time offers, no subscription.
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-right shadow-sm">
          <p className="text-[11px] uppercase tracking-wide text-neutral-400">Your balance</p>
          <p className="font-mono text-xl font-bold text-neutral-900">
            {sub.credits_remaining.toLocaleString()}{" "}
            <span className="text-sm font-normal text-neutral-400">credits</span>
          </p>
        </div>
      </div>

      {/* How delivery works */}
      <div
        className="mt-5 rounded-xl border px-4 py-3 text-sm"
        style={{ borderColor: `${GOLD}55`, backgroundColor: `${GOLD}12`, color: "#6b5a1f" }}
      >
        <span className="font-semibold">How it works:</span> checkout is handled securely on
        launchpadjv. Your credits and features are added to this account once your purchase is
        confirmed.
      </div>

      {/* Offer grid */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {UPSELL_OFFERS.map((offer) => (
          <OfferCard key={offer.slug} offer={offer} />
        ))}
      </div>
    </div>
  );
}
