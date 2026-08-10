/**
 * Job progress + status helpers (service role). The single place that mutates a
 * generation_jobs row, plus the per-type step definitions used by the timeline UI.
 */

import { getSupabaseAdminClient } from "../supabase/admin";

export interface JobStep {
  label: string;
  at: number; // progress % at which this step is considered done
}

export const JOB_STEPS: Record<string, JobStep[]> = {
  word_search: [
    { label: "Metadata", at: 15 },
    { label: "Generating puzzles", at: 40 },
    { label: "Rendering PDF", at: 80 },
    { label: "Uploading assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
  sudoku: [
    { label: "Metadata", at: 15 },
    { label: "Generating puzzles", at: 40 },
    { label: "Rendering PDF", at: 80 },
    { label: "Uploading assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
  maze: [
    { label: "Metadata", at: 15 },
    { label: "Generating mazes", at: 40 },
    { label: "Rendering PDF", at: 80 },
    { label: "Uploading assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
  coloring: [
    { label: "Metadata", at: 15 },
    { label: "Generating line art", at: 40 },
    { label: "Rendering PDF", at: 80 },
    { label: "Uploading assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
  lowcontent: [
    { label: "Preparing", at: 15 },
    { label: "Building pages", at: 40 },
    { label: "Rendering PDF", at: 80 },
    { label: "Uploading assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
  tracing: [
    { label: "Preparing", at: 15 },
    { label: "Building pages", at: 40 },
    { label: "Rendering PDF", at: 80 },
    { label: "Uploading assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
  math: [
    { label: "Preparing", at: 15 },
    { label: "Generating problems", at: 40 },
    { label: "Rendering PDF", at: 80 },
    { label: "Uploading assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
  scramble: [
    { label: "Metadata", at: 15 },
    { label: "Generating puzzles", at: 40 },
    { label: "Rendering PDF", at: 80 },
    { label: "Uploading assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
  cryptogram: [
    { label: "Preparing", at: 15 },
    { label: "Encoding puzzles", at: 40 },
    { label: "Rendering PDF", at: 80 },
    { label: "Uploading assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
  dot_to_dot: [
    { label: "Preparing", at: 15 },
    { label: "Plotting dots", at: 40 },
    { label: "Rendering PDF", at: 80 },
    { label: "Uploading assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
  crossword: [
    { label: "Metadata & clues", at: 20 },
    { label: "Building grids", at: 45 },
    { label: "Rendering PDF", at: 80 },
    { label: "Uploading assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
  activity: [
    { label: "Preparing", at: 15 },
    { label: "Building puzzles", at: 45 },
    { label: "Rendering PDF", at: 80 },
    { label: "Uploading assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
  ebook: [
    { label: "Outline & chapters", at: 20 },
    { label: "Saving chapters", at: 75 },
    { label: "Finalizing", at: 95 },
    { label: "Complete", at: 100 },
  ],
  storybook: [
    { label: "Outline", at: 10 },
    { label: "Character bible", at: 20 },
    { label: "Illustrations", at: 60 },
    { label: "Render PDF", at: 85 },
    { label: "Upload assets", at: 95 },
    { label: "Complete", at: 100 },
  ],
};

export const ACTIVE_STATUSES = ["queued", "processing"] as const;

// Some image-heavy generations can spend more than ten minutes between
// milestone callbacks. Keep the lease long enough that a healthy attempt is not
// fenced while the worker is still producing assets; progress renews it.
const LEASE_SECONDS = 30 * 60;

export interface ClaimedJob {
  id: string;
  user_id: string;
  job_type: string;
  input: Record<string, unknown> | null;
  attempt_token: string;
  attempt_no: number;
  credit_cost: number;
}

export type JobActionOutcome = "ok" | "not_found" | "invalid_state";

export class JobAttemptLostError extends Error {
  constructor() {
    super("Job attempt no longer owns the lease");
    this.name = "JobAttemptLostError";
  }
}

export async function claimJob(jobId: string): Promise<ClaimedJob | null> {
  const { data, error } = await getSupabaseAdminClient().rpc("job_claim", {
    p_job: jobId,
    p_lease_seconds: LEASE_SECONDS,
  });
  if (error) throw error;
  return (data as ClaimedJob | null) ?? null;
}

/** Expired attempts are failed/refunded, never requeued onto a live old runner. */
export async function reclaimStaleJobs(thresholdMinutes = 10): Promise<string[]> {
  const { data, error } = await getSupabaseAdminClient().rpc("job_reclaim_stale", {
    p_stale_seconds: Math.max(30, Math.floor(thresholdMinutes * 60)),
  });
  if (error) throw error;
  return (data as string[] | null) ?? [];
}

export async function markCompleted(
  jobId: string,
  attemptToken: string,
  bookId: string,
  meta: Record<string, unknown> = {}
): Promise<boolean> {
  const { data, error } = await getSupabaseAdminClient().rpc("job_complete", {
    p_job: jobId,
    p_token: attemptToken,
    p_book: bookId,
    p_meta: meta,
  });
  if (error) throw error;
  return data === true;
}

export async function markFailed(
  jobId: string,
  attemptToken: string,
  message: string,
  meta: Record<string, unknown> = {}
): Promise<boolean> {
  const { data, error } = await getSupabaseAdminClient().rpc("job_fail", {
    p_job: jobId,
    p_token: attemptToken,
    p_message: message.slice(0, 500),
    p_meta: meta,
  });
  if (error) throw error;
  return data === true;
}

export function progressUpdater(jobId: string, attemptToken: string) {
  return async (step: string, percent: number): Promise<void> => {
    const { data, error } = await getSupabaseAdminClient().rpc("job_progress", {
      p_job: jobId,
      p_token: attemptToken,
      p_step: step,
      p_progress: Math.round(percent),
      p_lease_seconds: LEASE_SECONDS,
    });
    if (error) throw error;
    if (data !== true) throw new JobAttemptLostError();
  };
}

export async function cancelJob(jobId: string, userId: string): Promise<JobActionOutcome> {
  const { data, error } = await getSupabaseAdminClient().rpc("job_cancel", {
    p_job: jobId,
    p_user: userId,
  });
  if (error) throw error;
  return ((data as { outcome?: JobActionOutcome } | null)?.outcome ?? "invalid_state");
}

export async function deleteJob(jobId: string, userId: string): Promise<JobActionOutcome> {
  const { data, error } = await getSupabaseAdminClient().rpc("job_delete", {
    p_job: jobId,
    p_user: userId,
  });
  if (error) throw error;
  return ((data as { outcome?: JobActionOutcome } | null)?.outcome ?? "invalid_state");
}
