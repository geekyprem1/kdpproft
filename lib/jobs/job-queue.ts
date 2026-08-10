/**
 * In-process job queue (Option 1: same-server background execution).
 *
 * `enqueue` creates the job row and kicks off `runJob` fire-and-forget — the API
 * returns immediately while generation continues in the server process. State
 * lives in the DB so the user can leave/refresh/log out and come back. A
 * `running` set prevents double-execution within one process; `recoverQueuedJobs`
 * re-kicks jobs that were queued but never started (e.g. just before a restart).
 *
 * To move to a durable worker / Trigger.dev later, only this file changes.
 */

import { getSupabaseAdminClient } from "../supabase/admin";
import { getOrCreateSubscription } from "../billing/subscription";
import { InsufficientCreditsError } from "../billing";
import { runJob } from "./job-runner";

const running = new Set<string>();

export interface CreateJobInput {
  jobType: string;
  bookType: string;
  title: string;
  input: Record<string, unknown>;
}

export async function createJob(userId: string, opts: CreateJobInput): Promise<string> {
  await getOrCreateSubscription(userId);
  const rawCost = Number(opts.input._cost);
  const cost = Number.isFinite(rawCost) ? Math.max(0, Math.floor(rawCost)) : 0;
  const { data, error } = await getSupabaseAdminClient().rpc("job_create_with_reservation", {
    p_user: userId,
    p_job_type: opts.jobType,
    p_book_type: opts.bookType,
    p_title: opts.title,
    p_input: opts.input,
    p_credit_cost: cost,
  });
  if (error) throw error;
  const result = data as { outcome?: string; job_id?: string; balance?: number } | null;
  if (result?.outcome === "insufficient_credits") {
    throw new InsufficientCreditsError(cost, result.balance ?? 0);
  }
  if (result?.outcome !== "ok" || !result.job_id) throw new Error("could not create job");
  return result.job_id;
}

export function startJob(jobId: string): void {
  if (running.has(jobId)) return;
  running.add(jobId);
  void runJob(jobId)
    .catch((e) => console.error(`job ${jobId} crashed:`, e))
    .finally(() => running.delete(jobId));
}

export async function enqueue(userId: string, opts: CreateJobInput): Promise<string> {
  const jobId = await createJob(userId, opts);
  startJob(jobId);
  return jobId;
}

export function isRunning(jobId: string): boolean {
  return running.has(jobId);
}

/** Re-kick queued jobs that aren't currently running (best-effort recovery). */
export async function recoverQueuedJobs(userId: string): Promise<void> {
  const { data, error } = await getSupabaseAdminClient()
    .from("generation_jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "queued");
  if (error) throw error;
  for (const row of (data ?? []) as Array<{ id: string }>) {
    if (!running.has(row.id)) startJob(row.id);
  }
}

export interface RetryResult {
  ok: boolean;
  error?: "not_found" | "already_active" | "insufficient_credits";
}

/** Atomically settle the old attempt, reserve once, and queue only retryable jobs. */
export async function retryJob(jobId: string, userId?: string): Promise<RetryResult> {
  const { data, error } = await getSupabaseAdminClient().rpc("job_retry", {
    p_job: jobId,
    p_user: userId ?? null,
  });
  if (error) throw error;
  const result = data as { outcome?: string } | null;
  if (result?.outcome === "not_found") return { ok: false, error: "not_found" };
  if (result?.outcome === "invalid_state") return { ok: false, error: "already_active" };
  if (result?.outcome === "insufficient_credits") return { ok: false, error: "insufficient_credits" };
  if (result?.outcome !== "ok") throw new Error("Invalid job retry response");
  startJob(jobId);
  return { ok: true };
}
