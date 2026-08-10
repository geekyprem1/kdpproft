/** Optional durable job worker. */

import { getSupabaseAdminClient } from "../lib/supabase/admin";
import { runJob } from "../lib/jobs/job-runner";
import { reclaimStaleJobs } from "../lib/jobs/job-progress";

const POLL_MS = Number(process.env.WORKER_POLL_MS) || 5000;
const STALE_MIN = Number(process.env.WORKER_STALE_MIN) || 10;
const MAX_CONCURRENT = Number(process.env.WORKER_CONCURRENCY) || 2;

let active = 0;
let ticking = false;

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const stale = await reclaimStaleJobs(STALE_MIN);
    if (stale.length) console.log(`[worker] failed and refunded ${stale.length} expired job attempt(s)`);

    const slots = MAX_CONCURRENT - active;
    if (slots <= 0) return;

    const { data, error } = await getSupabaseAdminClient()
      .from("generation_jobs")
      .select("id, title")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(slots);
    if (error) throw error;

    for (const row of (data ?? []) as Array<{ id: string; title: string | null }>) {
      active++;
      console.log(`[worker] running job ${row.id} (${row.title ?? "?"})`);
      void runJob(row.id)
        .catch((runError) => console.error(`[worker] job ${row.id} failed:`, runError))
        .finally(() => { active--; });
    }
  } finally {
    ticking = false;
  }
}

async function main(): Promise<void> {
  console.log(`[worker] started — poll ${POLL_MS}ms, concurrency ${MAX_CONCURRENT}, stale ${STALE_MIN}min`);
  await tick().catch((error) => console.error("[worker] tick error:", error));
  setInterval(() => {
    void tick().catch((error) => console.error("[worker] tick error:", error));
  }, POLL_MS);
}

void main();
