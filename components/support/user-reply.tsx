"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UserReply({ ticketId, closed }: { ticketId: string; closed: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (closed) {
    return <p className="rounded-lg bg-neutral-50 p-3 text-sm text-neutral-500">This ticket is closed. Open a new ticket if you need more help.</p>;
  }

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/support/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Failed");
      setBody("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Add a reply…" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" />
      <div className="mt-2 flex items-center gap-3">
        <button onClick={send} disabled={busy || !body.trim()} className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "Sending…" : "Send Reply"}
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
}
