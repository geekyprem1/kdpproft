import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CoverGenerator } from "@/components/dashboard/cover-generator";
import { COVER_GENRE_LABELS, type CoverGenre } from "@/lib/cover";

export const dynamic = "force-dynamic";

interface CoverRow {
  id: string;
  title: string;
  genre: string | null;
  created_at: string;
}

export default async function CoverPage() {
  const supabase = await createSupabaseServerClient();
  const [{ data: bookData }, { data: coverData }] = await Promise.all([
    supabase.from("books").select("id, title").order("created_at", { ascending: false }).limit(50),
    supabase.from("covers").select("id, title, genre, created_at").order("created_at", { ascending: false }).limit(30),
  ]);
  const books = (bookData ?? []) as Array<{ id: string; title: string }>;
  const covers = (coverData ?? []) as CoverRow[];

  const typeLabel = (t: string | null) =>
    t ? COVER_GENRE_LABELS[t as CoverGenre] ?? t : "—";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Cover Studio</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Generate 3 professional KDP cover variations — AI background art with crisp
        typeset title, tuned to your book type.
      </p>

      <div className="mt-6">
        <CoverGenerator books={books} />
      </div>

      <h2 className="mt-10 text-lg font-semibold">Cover library</h2>
      {covers.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No covers yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {covers.map((c) => (
            <li key={c.id}>
              <Link href={`/dashboard/cover/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50">
                <div>
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="text-xs text-neutral-500">{typeLabel(c.genre)} · {new Date(c.created_at).toLocaleDateString()}</div>
                </div>
                <span className="text-sm text-neutral-400">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
