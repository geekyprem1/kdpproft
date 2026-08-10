"use client";

import { useEffect, useState } from "react";

/** Lively loading panel for synchronous (single-request) generations like the
 *  Cover Studio, where there's no server-side progress to poll. Shows an
 *  indeterminate shimmer bar, a spinner, rotating reassurance messages, and a
 *  live elapsed timer so the wait feels active instead of a dead button. */
export function InlineGenerating({ messages, note }: { messages: string[]; note?: string }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsedMs = now - start;
  const msg = messages[Math.floor(elapsedMs / 2500) % messages.length];
  const s = Math.floor(elapsedMs / 1000);
  const time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-4 w-4 rounded-full border-2 border-neutral-300 border-t-neutral-900"
            style={{ animation: "kdpm-spin 0.8s linear infinite" }}
          />
          <span className="text-sm font-semibold text-neutral-800">{msg}</span>
        </div>
        <span className="text-xs tabular-nums text-neutral-400">{time}</span>
      </div>

      <div className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div
          className="absolute inset-y-0 rounded-full bg-neutral-900"
          style={{ width: "40%", animation: "kdpm-indeterminate 1.3s ease-in-out infinite" }}
        />
      </div>

      {note && <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">{note}</p>}
    </div>
  );
}
