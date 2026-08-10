"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface PlanOption { key: string; name: string }
interface OfferOption { key: string; label: string }

export function UserActions({
  userId,
  accountStatus,
  isSuperAdmin,
  plans,
  offers,
}: {
  userId: string;
  accountStatus: string;
  isSuperAdmin: boolean;
  plans: PlanOption[];
  offers: OfferOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [planKey, setPlanKey] = useState(plans[0]?.key ?? "free");
  const [offerKey, setOfferKey] = useState(offers[0]?.key ?? "");

  async function post(payload: Record<string, unknown>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Action failed");
      setMsg("Done ✓");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const amt = Math.floor(Number(amount));
  const amtValid = Number.isFinite(amt) && amt > 0;

  const btn = "rounded px-3 py-1.5 text-xs font-medium disabled:opacity-50 transition-colors";

  return (
    <div className="space-y-5 rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-700">Admin Actions</h2>

      {/* Credits */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Credits & Billing</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount" className="w-24 rounded border border-neutral-300 px-2 py-1.5 text-xs"
          />
          <input
            type="text" value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)" className="w-40 rounded border border-neutral-300 px-2 py-1.5 text-xs"
          />
          <button disabled={busy || !amtValid} onClick={() => post({ action: "grant_credits", amount: amt, reason })} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>Grant</button>
          <button disabled={busy || !amtValid} onClick={() => post({ action: "remove_credits", amount: amt, reason })} className={`${btn} border border-neutral-300 text-neutral-700 hover:bg-neutral-50`}>Remove</button>
          <button disabled={busy || !amtValid} onClick={() => post({ action: "refund", amount: amt, reason })} className={`${btn} border border-neutral-300 text-neutral-700 hover:bg-neutral-50`}>Refund</button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={planKey} onChange={(e) => setPlanKey(e.target.value)} className="rounded border border-neutral-300 px-2 py-1.5 text-xs">
            {plans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
          </select>
          <button disabled={busy} onClick={() => post({ action: "change_plan", planKey }, `Change plan to ${planKey}? This grants that plan's credits.`)} className={`${btn} bg-neutral-900 text-white hover:bg-neutral-700`}>Change Plan</button>
        </div>
      </div>

      {/* Deliver a JVZoo offer (credits + entitlements in one step) */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Deliver JVZoo Offer</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={offerKey} onChange={(e) => setOfferKey(e.target.value)} className="max-w-xs rounded border border-neutral-300 px-2 py-1.5 text-xs">
            {offers.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          <button
            disabled={busy || !offerKey}
            onClick={() => post(
              { action: "grant_offer", offerKey },
              `Deliver "${offers.find((o) => o.key === offerKey)?.label}" to this user? Adds its credits and unlocks its features.`
            )}
            className={`${btn} text-black hover:opacity-90`}
            style={{ backgroundColor: "#C9A84C" }}
          >
            Grant Offer
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-400">Use this after a launchpadjv sale — the buyer gets exactly what the offer includes.</p>
      </div>

      {/* Account status */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Account Status</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {accountStatus === "active" ? (
            <>
              <button disabled={busy} onClick={() => post({ action: "suspend", reason }, "Suspend this user?")} className={`${btn} bg-amber-500 text-white hover:bg-amber-600`}>Suspend</button>
              <button disabled={busy} onClick={() => post({ action: "ban", reason }, "Ban this user?")} className={`${btn} bg-red-600 text-white hover:bg-red-700`}>Ban</button>
            </>
          ) : (
            <button disabled={busy} onClick={() => post({ action: "restore" }, "Restore this user to active?")} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>Restore</button>
          )}
          <button disabled={busy} onClick={() => post({ action: "soft_delete", reason }, "Soft-delete this user? They lose access but data is retained.")} className={`${btn} border border-red-300 text-red-700 hover:bg-red-50`}>Soft Delete</button>
          {isSuperAdmin && (
            <button disabled={busy} onClick={() => post({ action: "hard_delete" }, "PERMANENTLY delete this user and ALL their data? This cannot be undone.")} className={`${btn} bg-red-800 text-white hover:bg-red-900`}>Hard Delete</button>
          )}
        </div>
      </div>

      {msg && <p className="text-xs text-neutral-600">{msg}</p>}
    </div>
  );
}
