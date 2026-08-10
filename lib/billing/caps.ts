/**
 * Fair-use generation caps — rolling daily + monthly limits per user.
 *
 * These bound ongoing AI cost against a ONE-TIME payment (especially the
 * credit-free Unlimited tier). Counts come from `usage_events` (no new table).
 * Applied to everyone via assertFeature(), so Unlimited buyers are capped too;
 * metered buyers are additionally bounded by their credit balance.
 *
 * - Book cap: any book-producing engine.
 * - Image cap: the image-heavy (real-cost) engines — stricter.
 * An image book counts against BOTH caps.
 */

import { getSupabaseAdminClient } from "../supabase/admin";
import type { Feature } from "./plans";

export const CAP_BOOK_DAILY = 10;
export const CAP_BOOK_MONTHLY = 100;
export const CAP_IMAGE_DAILY = 5;
export const CAP_IMAGE_MONTHLY = 50;

/** Book-producing engines that count toward the book cap. */
const BOOK_ACTIONS = new Set<string>([
  "word_search", "sudoku", "maze", "crossword", "scramble", "cryptogram", "dot_to_dot",
  "coloring", "activity", "tracing", "math", "lowcontent", "ebook", "storybook",
]);

/** Image-heavy engines (real per-book cost) — the stricter cap. */
const IMAGE_ACTIONS = new Set<string>(["coloring", "storybook", "cover_v2"]);

export class CapReachedError extends Error {
  scope: "book" | "image";
  window: "day" | "month";
  limit: number;
  constructor(scope: "book" | "image", window: "day" | "month", limit: number) {
    super(`${scope} ${window} limit reached`);
    this.name = "CapReachedError";
    this.scope = scope;
    this.window = window;
    this.limit = limit;
  }
}

const DAY_MS = 24 * 3600 * 1000;

/** Count a user's completed generations for the given actions since an ISO time. */
async function countSince(userId: string, actions: string[], sinceIso: string): Promise<number> {
  const admin = getSupabaseAdminClient();
  const { count, error } = await admin
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("action", actions)
    .eq("status", "completed")
    .gte("created_at", sinceIso);
  if (error) {
    // Fail open on a counting error — never block a paying user because analytics
    // hiccuped. The credit ledger is still the hard spend guard for metered tiers.
    console.error("[caps] count failed:", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Throw CapReachedError if this generation would exceed a daily/monthly cap.
 * No-op for non-book features (niche, title, publish package, cover v1).
 */
export async function assertWithinCaps(userId: string, feature: Feature): Promise<void> {
  const isImage = IMAGE_ACTIONS.has(feature);
  const isBook = BOOK_ACTIONS.has(feature);
  if (!isImage && !isBook) return;

  const now = Date.now();
  const dayAgo = new Date(now - DAY_MS).toISOString();
  const monthAgo = new Date(now - 30 * DAY_MS).toISOString();

  if (isImage) {
    const imgActions = [...IMAGE_ACTIONS];
    if ((await countSince(userId, imgActions, dayAgo)) >= CAP_IMAGE_DAILY) {
      throw new CapReachedError("image", "day", CAP_IMAGE_DAILY);
    }
    if ((await countSince(userId, imgActions, monthAgo)) >= CAP_IMAGE_MONTHLY) {
      throw new CapReachedError("image", "month", CAP_IMAGE_MONTHLY);
    }
  }

  if (isBook) {
    const bookActions = [...BOOK_ACTIONS];
    if ((await countSince(userId, bookActions, dayAgo)) >= CAP_BOOK_DAILY) {
      throw new CapReachedError("book", "day", CAP_BOOK_DAILY);
    }
    if ((await countSince(userId, bookActions, monthAgo)) >= CAP_BOOK_MONTHLY) {
      throw new CapReachedError("book", "month", CAP_BOOK_MONTHLY);
    }
  }
}
