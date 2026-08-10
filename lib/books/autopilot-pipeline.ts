/**
 * Autopilot pipeline: write 3 ebooks ONE AFTER ANOTHER (sequentially).
 *
 * Sequential on purpose — three ebooks generating at once fire ~15 concurrent
 * OpenRouter calls (outline + chaptered writing per book), which trips the
 * provider timeout. Running them in series keeps each book well within budget.
 *
 * Credits are reserved and settled PER BOOK here: reserve right before writing a
 * book, keep the charge on success, refund on failure. This is symmetric, so a
 * retry re-reserves each book cleanly with no double-refund — the Autopilot job
 * itself carries no reservation.
 */

import { getSupabaseAdminClient } from "../supabase/admin";
import { generateAndStoreEbook } from "./ebook-pipeline";
import { reserve, refund, recordUsage, InsufficientCreditsError } from "../billing";

export type AutopilotAngleStatus = "pending" | "writing" | "done" | "failed";

export interface AutopilotAngle {
  title: string;
  angle: string;
  status?: AutopilotAngleStatus;
  bookId?: string | null;
  error?: string | null;
}

interface AutopilotInput {
  runId: string;
  audience?: string;
  author?: string;
  trimSize?: string;
  chapterCount?: number;
  targetWords?: number;
  costPerBook: number;
}

export interface AutopilotResult {
  firstBookId: string | null;
  doneCount: number;
  total: number;
  /** First per-book error, surfaced to the job so failures aren't opaque. */
  firstError: string | null;
}

function readInput(raw: Record<string, unknown>): AutopilotInput {
  return {
    runId: String(raw.runId ?? ""),
    audience: typeof raw.audience === "string" ? raw.audience : undefined,
    author: typeof raw.author === "string" ? raw.author : undefined,
    trimSize: typeof raw.trimSize === "string" ? raw.trimSize : undefined,
    chapterCount: typeof raw.chapterCount === "number" ? raw.chapterCount : undefined,
    targetWords: typeof raw.targetWords === "number" ? raw.targetWords : undefined,
    costPerBook: typeof raw.costPerBook === "number" ? raw.costPerBook : 0,
  };
}

/**
 * Generate all books for one Autopilot run, in series. Updates the run's angle
 * statuses as it goes so the progress page can show per-book state. Idempotent on
 * restart: angles that already produced a completed book are skipped.
 */
export async function runAutopilotBooks(
  userId: string,
  rawInput: Record<string, unknown>,
  onProgress: (step: string, percent: number) => Promise<void>
): Promise<AutopilotResult> {
  const input = readInput(rawInput);
  const admin = getSupabaseAdminClient();

  const { data: runRow } = await admin
    .from("autopilot_runs")
    .select("angles")
    .eq("id", input.runId)
    .single();

  const angles: AutopilotAngle[] = Array.isArray(runRow?.angles)
    ? (runRow!.angles as AutopilotAngle[])
    : [];
  const total = angles.length;
  if (total === 0) return { firstBookId: null, doneCount: 0, total: 0, firstError: null };

  const saveAngles = async () => {
    await admin.from("autopilot_runs").update({ angles }).eq("id", input.runId);
  };

  let firstBookId: string | null = null;
  let firstError: string | null = null;
  let doneCount = 0;

  for (let i = 0; i < total; i++) {
    const a = angles[i];

    // Restart recovery: don't regenerate a book that already completed.
    if (a.status === "done" && a.bookId) {
      doneCount++;
      firstBookId = firstBookId ?? a.bookId;
      continue;
    }

    a.status = "writing";
    a.error = null;
    await saveAngles();

    // Reserve this book's credits right before writing it (atomic). If the user
    // can't afford it, mark the book failed and move on.
    try {
      await reserve(userId, input.costPerBook, "autopilot", input.runId);
    } catch (reserveError) {
      const msg =
        reserveError instanceof InsufficientCreditsError
          ? "Not enough credits for this book"
          : "Could not reserve credits";
      a.status = "failed";
      a.error = msg;
      firstError = firstError ?? msg;
      await saveAngles();
      continue;
    }

    const base = (i / total) * 100;
    const span = 100 / total;
    const bookProgress = async (step: string, pct: number) => {
      await onProgress(`Book ${i + 1}/${total}: ${step}`, Math.round(base + (pct / 100) * span));
    };

    try {
      const result = await generateAndStoreEbook(
        userId,
        {
          topic: a.angle,
          title: a.title,
          audience: input.audience,
          author: input.author,
          trimSize: input.trimSize,
          chapterCount: input.chapterCount,
          targetWords: input.targetWords,
        },
        { autopilotRunId: input.runId, onProgress: bookProgress }
      );
      a.status = "done";
      a.bookId = result.id;
      a.error = null;
      doneCount++;
      firstBookId = firstBookId ?? result.id;
      await saveAngles();
      try {
        await recordUsage(userId, "ebook", input.costPerBook, "completed", result.id, { topic: a.angle });
      } catch (usageError) {
        console.error("autopilot usage recording failed:", usageError);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      console.error(`autopilot book ${i + 1} failed:`, err);
      a.status = "failed";
      a.error = message;
      firstError = firstError ?? message;
      await saveAngles();
      // Give back this book's reserved credits — only successful books are charged.
      try {
        await refund(userId, input.costPerBook, input.runId);
      } catch (refundError) {
        console.error("autopilot refund failed:", refundError);
      }
      try {
        await recordUsage(userId, "ebook", input.costPerBook, "failed", undefined, { topic: a.angle });
      } catch {
        /* analytics only */
      }
    }
  }

  const status = doneCount === total ? "completed" : doneCount === 0 ? "failed" : "partial";
  await admin.from("autopilot_runs").update({ status }).eq("id", input.runId);

  return { firstBookId, doneCount, total, firstError };
}
