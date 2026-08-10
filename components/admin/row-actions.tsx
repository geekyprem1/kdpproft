"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Generic admin row action button set that POSTs {action} to an endpoint. */
export function RowActions({
  endpoint,
  actions,
}: {
  endpoint: string;
  actions: Array<{ action: string; label: string; confirm?: string; danger?: boolean }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(action: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Action failed");
      } else {
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1.5">
      {actions.map((a) => (
        <button
          key={a.action}
          disabled={busy}
          onClick={() => run(a.action, a.confirm)}
          className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
            a.danger
              ? "border border-red-300 text-red-700 hover:bg-red-50"
              : "border border-neutral-300 text-neutral-700 hover:bg-neutral-50"
          }`}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
