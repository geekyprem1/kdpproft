"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["open", "pending", "answered", "closed"];

export function TicketAdminPanel({ ticketId, currentStatus }: { ticketId: string; currentStatus: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Failed");
      if (payload.action === "reply") setBody("");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500">Status:</span>
        <select
          value={currentStatus}
          onChange={(e) => send({ action: "status", status: e.target.value })}
          disabled={busy}
          className="rounded border border-neutral-300 px-2 py-1 text-xs"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Write a reply to the customer…"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-3">
        <button
          disabled={busy || !body.trim()}
          onClick={() => send({ action: "reply", body: body.trim() })}
          className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send Reply"}
        </button>
        {err && <span className="text-xs text-red-600">{err}</span>}
      </div>
    </div>
  );
}
