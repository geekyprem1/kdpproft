/**
 * Admin book monitoring. Read-all + delete (removes storage objects + row).
 */

import { getSupabaseAdminClient } from "../supabase/admin";
import { PersistenceError, requireMutationRow } from "../supabase/errors";
import { logAdminAction } from "./audit";
import type { AdminIdentity } from "./roles";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "books";

export interface AdminBookRow {
  id: string;
  user_id: string;
  user_email: string | null;
  title: string;
  book_type: string;
  status: string;
  created_at: string;
}

export async function listBooks(opts: { status?: string; limit?: number } = {}): Promise<AdminBookRow[]> {
  const admin = getSupabaseAdminClient();
  let q = admin
    .from("books")
    .select("id, user_id, title, book_type, status, created_at, profiles(email)")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.status?.trim()) q = q.eq("status", opts.status.trim());

  const { data } = await q;
  return ((data ?? []) as unknown as Array<Record<string, unknown> & { profiles: { email: string } | { email: string }[] | null }>).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    return {
      id: r.id as string,
      user_id: r.user_id as string,
      user_email: p?.email ?? null,
      title: r.title as string,
      book_type: r.book_type as string,
      status: r.status as string,
      created_at: r.created_at as string,
    };
  });
}

/** Delete a book: best-effort storage cleanup, then the row (cascades metadata/downloads). */
export async function adminDeleteBook(actor: AdminIdentity, bookId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const lookupResult = await admin.from("books")
    .select("id, interior_key, cover_key")
    .eq("id", bookId)
    .maybeSingle();
  if (lookupResult.error) throw new PersistenceError("Find book", lookupResult.error);
  if (!lookupResult.data) {
    requireMutationRow(lookupResult, "Find book", "Book");
    return;
  }

  const keys = [lookupResult.data.interior_key, lookupResult.data.cover_key].filter(Boolean) as string[];
  if (keys.length) {
    const { error } = await admin.storage.from(BUCKET).remove(keys);
    if (error) console.error("[admin] storage cleanup failed:", error);
  }

  const deleteResult = await admin.from("books").delete().eq("id", bookId).select("id").maybeSingle();
  requireMutationRow(deleteResult, "Delete book", "Book");
  await logAdminAction(actor, "delete_book", { targetType: "book", targetId: bookId });
}
