import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isStorageConfigured } from "@/lib/storage";
import { type PipelineBookType } from "@/lib/books/pipeline";
import { enqueue } from "@/lib/jobs/job-queue";
import { costFor, refund, reserve, type Feature } from "@/lib/billing";
import { assertFeature, billingErrorResponse } from "@/lib/billing/guard";
import { GenerationInputError, normalizePuzzleCount } from "@/lib/generation-input";
import { rateLimit, rateLimitResponse } from "@/lib/util/rate-limit";
import { isLowContentLayout } from "@/lib/generators/lowcontent";
import { TRIM_SIZES } from "@/lib/pdf/kdp-specs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: PipelineBookType[] = [
  "word_search", "sudoku", "maze", "coloring",
  "lowcontent", "tracing", "math",
  "scramble", "cryptogram", "dot_to_dot", "crossword", "activity",
];
const LABEL: Record<PipelineBookType, string> = {
  word_search: "Word Search",
  sudoku: "Sudoku Puzzle Book",
  maze: "Maze Puzzle Book",
  coloring: "Coloring Book",
  lowcontent: "Journal / Planner",
  tracing: "Tracing Workbook",
  math: "Math Workbook",
  scramble: "Word Scramble",
  cryptogram: "Cryptogram Puzzles",
  dot_to_dot: "Connect the Dots",
  crossword: "Crossword Puzzles",
  activity: "Activity Book",
};
// Types whose "count" means PAGES/PUZZLES validated inside the generator; the route
// just clamps to a safe wide range instead of the puzzle-count config.
const PAGE_COUNT_TYPES: PipelineBookType[] = [
  "lowcontent", "tracing", "math", "scramble", "cryptogram", "dot_to_dot", "crossword", "activity",
];
// Themed types that require a theme/topic (like word search).
const THEME_TYPES: PipelineBookType[] = ["word_search", "coloring", "scramble", "crossword", "activity"];

/** Enqueue a background generation job and return immediately. */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const rl = rateLimit(`books:${user.id}`, 10);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);
  if (!isStorageConfigured()) return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.bookType === "ebook") return NextResponse.json({ error: "Use /api/ebook for ebooks." }, { status: 400 });

  const bookType: PipelineBookType = TYPES.includes(body.bookType as PipelineBookType)
    ? (body.bookType as PipelineBookType)
    : "word_search";

  // Page-based types (lowcontent/tracing/math) count PAGES, not puzzles; the
  // generator clamps to its own range, so the route only needs a wide safe clamp.
  let layout: string | undefined;
  let trim: string | undefined;
  let puzzleCount: number;
  if (PAGE_COUNT_TYPES.includes(bookType)) {
    if (bookType === "lowcontent") {
      if (!isLowContentLayout(body.layout)) {
        return NextResponse.json({ error: "A valid layout is required" }, { status: 400 });
      }
      layout = body.layout;
      trim = typeof body.trim === "string" && body.trim in TRIM_SIZES ? body.trim : undefined;
    }
    const rawPages = Number(body.pageCount ?? body.puzzleCount ?? body.count);
    puzzleCount = Number.isFinite(rawPages) ? Math.min(300, Math.max(20, Math.round(rawPages))) : 30;
  } else {
    try {
      puzzleCount = normalizePuzzleCount(bookType, body.puzzleCount);
    } catch (error) {
      if (error instanceof GenerationInputError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  }

  const theme = typeof body.theme === "string" ? body.theme.trim() : "";
  if (THEME_TYPES.includes(bookType) && !theme) {
    return NextResponse.json({ error: "Theme is required" }, { status: 400 });
  }
  const userTitle = typeof body.title === "string" ? body.title.trim() : "";
  const displayTitle = userTitle || (theme ? theme : LABEL[bookType]);
  const input = {
    theme: theme || undefined,
    title: userTitle || undefined,
    difficulty: typeof body.difficulty === "string" ? body.difficulty : undefined,
    count: puzzleCount,
    ageGroup: typeof body.ageGroup === "string" ? body.ageGroup : undefined,
    style: typeof body.style === "string" ? body.style : undefined,
    layout,
    trim,
    set: typeof body.set === "string" ? body.set : undefined,
    operation: typeof body.operation === "string" ? body.operation : undefined,
    largePrint: body.largePrint === true,
    opportunity: body.opportunity && typeof body.opportunity === "object" ? body.opportunity : undefined,
  };
  const cost = costFor(bookType, { count: puzzleCount });

  try {
    await assertFeature(user.id, bookType as Feature);
    await reserve(user.id, cost, "job");
  } catch (e) {
    const r = billingErrorResponse(e);
    if (r) return r;
    throw e;
  }

  try {
    const jobId = await enqueue(user.id, {
      jobType: bookType,
      bookType,
      title: displayTitle,
      input: { ...input, _cost: cost, _action: bookType },
    });
    return NextResponse.json({ jobId, cost });
  } catch (enqueueError) {
    const billingResponse = billingErrorResponse(enqueueError);
    if (billingResponse) return billingResponse;
    // job_create_with_reservation is atomic: a failed enqueue did not debit
    // credits, so compensating here would incorrectly add free credits.
    console.error("book enqueue failed", enqueueError);
    return NextResponse.json({ error: "Could not queue book generation" }, { status: 500 });
  }
}
