/**
 * In-memory fixed-window rate limiter for abuse protection on expensive
 * (AI / Puppeteer) endpoints. Process-local — works on the long-running Node
 * host this app deploys to (one shared process). Not a substitute for a real
 * gateway limiter at scale, but it stops a single client from hammering
 * generation endpoints.
 */

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

/**
 * @param key      unique caller key (e.g. `books:<userId>`)
 * @param limit    max requests allowed per window
 * @param windowMs window length in ms (default 60s)
 */
export function rateLimit(key: string, limit: number, windowMs = 60_000): RateLimitResult {
  const now = Date.now();
  const w = buckets.get(key);

  if (!w || now >= w.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (w.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  }

  w.count += 1;
  return { ok: true, remaining: limit - w.count, retryAfterSec: 0 };
}

/** 429 JSON response helper. */
export function rateLimitResponse(retryAfterSec: number): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please slow down.", retryAfterSec }),
    {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": String(retryAfterSec) },
    }
  );
}

// Periodic cleanup so the map doesn't grow unbounded.
let sweepStarted = false;
export function startRateLimitSweep(): void {
  if (sweepStarted) return;
  sweepStarted = true;
  const t = setInterval(() => {
    const now = Date.now();
    for (const [k, w] of buckets) if (now >= w.resetAt) buckets.delete(k);
  }, 5 * 60_000);
  // don't keep the process alive just for the sweep
  if (typeof t.unref === "function") t.unref();
}
