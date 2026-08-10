import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireMutationRow } from "@/lib/supabase/errors";
import { rewriteChapter, wordCount, type RewriteAction } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ACTIONS: RewriteAction[] = ["rewrite", "expand", "shorten"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const idx = Number(body.idx);
  const action: RewriteAction = ACTIONS.includes(body.action as RewriteAction)
    ? (body.action as RewriteAction)
    : "rewrite";
  if (!Number.isInteger(idx)) return NextResponse.json({ error: "idx required" }, { status: 400 });

  // RLS scopes the book to the owner.
  const { data: book } = await supabase
    .from("books")
    .select("id, title, theme, config, book_type")
    .eq("id", id)
    .single();
  if (!book || book.book_type !== "ebook") {
    return NextResponse.json({ error: "Ebook not found" }, { status: 404 });
  }
  const { data: chapter } = await supabase
    .from("ebook_chapters")
    .select("idx, title, content_md")
    .eq("book_id", id)
    .eq("idx", idx)
    .single();
  if (!chapter) return NextResponse.json({ error: "Chapter not found" }, { status: 404 });

  const cfg = (book.config ?? {}) as { audience?: string; tone?: string };
  try {
    const content = await rewriteChapter({
      bookTitle: book.title,
      topic: book.theme,
      audience: cfg.audience ?? "general readers",
      tone: cfg.tone ?? "friendly",
      chapterTitle: chapter.title,
      current: chapter.content_md,
      action,
    });
    const wc = wordCount(content);
    const updateResult = await getSupabaseAdminClient()
      .from("ebook_chapters")
      .update({ content_md: content, word_count: wc, status: "written", updated_at: new Date().toISOString() })
      .eq("book_id", id)
      .eq("idx", idx)
      .select("id")
      .maybeSingle();
    requireMutationRow(updateResult, "Save rewritten chapter", "Chapter");

    return NextResponse.json({ content, wordCount: wc });
  } catch (err) {
    console.error("chapter rewrite failed:", err);
    return NextResponse.json({ error: "Rewrite failed. Please try again." }, { status: 500 });
  }
}
