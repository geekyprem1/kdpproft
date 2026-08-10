import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BundleGenerator } from "@/components/dashboard/bundle-generator";

export const dynamic = "force-dynamic";

interface BundleRow {
  id: string;
  topic: string;
  book_types: string[] | null;
  status: string;
  created_at: string;
}

export default async function BundlePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("bundles")
    .select("id, topic, book_types, status, created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  const bundles = (data ?? []) as BundleRow[];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Publishing Factory™</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Create multiple publishing assets from one niche. Enter a topic, and the
        Publishing Factory™ recommends the best book mix and produces them all —
        with a suggested publishing order to maximize your KDP catalogue.
      </p>

      <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">What gets produced</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {["Word Search", "Sudoku", "Maze", "Coloring Book", "Ebook"].map((t) => (
            <span key={t} className="rounded-full bg-white border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700">
              {t}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Opportunity Score powers recommendations — every book type is scored for
          demand, competition, and monetization before production begins.
        </p>
      </div>

      <div className="mt-6">
        <BundleGenerator />
      </div>

      <h2 className="mt-10 text-lg font-semibold">Your bundles</h2>
      {bundles.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">No bundles yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
          {bundles.map((b) => (
            <li key={b.id}>
              <Link href={`/dashboard/bundle/${b.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-neutral-50">
                <div>
                  <div className="text-sm font-medium">{b.topic}</div>
                  <div className="text-xs text-neutral-500">
                    {(b.book_types ?? []).length} books · {b.status} · {new Date(b.created_at).toLocaleDateString()}
                  </div>
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
