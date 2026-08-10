"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface OfferOption { key: string; label: string }

export function CreateUserForm({
  isSuperAdmin,
  offers,
}: {
  isSuperAdmin: boolean;
  /** Grantable offers; the Front End ("commercial") is the default selection. */
  offers: OfferOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  // Default to the Front End so a new user starts on the FE plan.
  const [offerKey, setOfferKey] = useState(
    offers.find((o) => o.key === "commercial")?.key ?? offers[0]?.key ?? "none"
  );

  function genPassword() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let out = "";
    const buf = new Uint32Array(14);
    crypto.getRandomValues(buf);
    for (const n of buf) out += chars[n % chars.length];
    setPassword(out + "@1");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, password, role, offerKey }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Create failed");
      setMsg(`Created ${j.email}. They can sign in now with the password you set.`);
      setEmail("");
      setFullName("");
      setPassword("");
      setRole("user");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setMsg(null); }}
        className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
      >
        + New User
      </button>
    );
  }

  const input = "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm";
  const label = "mb-1 block text-xs font-medium text-neutral-600";

  return (
    <div className="w-full rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-800">Create New User</h2>
        <button onClick={() => setOpen(false)} className="text-xs text-neutral-400 hover:text-neutral-700">Close</button>
      </div>

      <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Email *</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className={input} />
        </div>
        <div>
          <label className={label}>Full name</label>
          <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Optional" className={input} />
        </div>

        <div>
          <label className={label}>Password * (min 6)</label>
          <div className="flex gap-2">
            <input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a password" className={input} />
            <button type="button" onClick={genPassword} className="whitespace-nowrap rounded-lg border border-neutral-300 px-2 py-2 text-xs text-neutral-600 hover:bg-neutral-50">Generate</button>
          </div>
        </div>

        <div>
          <label className={label}>Starting offer / plan</label>
          <select value={offerKey} onChange={(e) => setOfferKey(e.target.value)} className={input}>
            {offers.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            <option value="none">None (Free Trial)</option>
          </select>
        </div>

        {isSuperAdmin && (
          <div>
            <label className={label}>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={input}>
              <option value="user">user</option>
              <option value="admin">admin</option>
              <option value="super_admin">super_admin</option>
            </select>
          </div>
        )}

        <div className="flex items-end">
          <button disabled={busy} className="rounded-lg bg-[#C9A84C] px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50">
            {busy ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>

      {msg && <p className="mt-3 rounded-lg border border-green-200 bg-green-50 p-2.5 text-xs text-green-800">{msg}</p>}
      {err && <p className="mt-3 text-xs text-red-600">{err}</p>}
    </div>
  );
}
