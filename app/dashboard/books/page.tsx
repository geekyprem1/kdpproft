import Link from "next/link";
import { Plus, FileText, FileImage, Package, BookOpen, FolderOpen } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BOOK_TYPE_LABELS, type BookType } from "@/lib/opportunity";
import { bookTypeMeta } from "@/components/dashboard/book-type-meta";

export const dynamic = "force-dynamic";

interface BookRow {
  id: string;
  title: string;
  theme: string;
  book_type: string;
  status: string;
  difficulty: string;
  puzzle_count: number;
  page_count: number | null;
  word_source: string | null;
  created_at: string;
  book_metadata: { subtitle: string | null; keywords: string[] | null } | null;
}

const STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  completed: { label: "Ready", cls: "bg-green-50 text-green-700 border-green-200", dot: "#16A34A" },
  generating: { label: "Processing", cls: "bg-blue-50 text-blue-700 border-blue-200", dot: "#2563EB" },
  failed: { label: "Needs Attention", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "#D97706" },
};

export default async function MyBooksPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("books")
    .select("*, book_metadata(subtitle, keywords)")
    .order("created_at", { ascending: false });

  const books = (data ?? []) as unknown as BookRow[];
  const typeLabel = (t: string) => BOOK_TYPE_LABELS[t as BookType] ?? t;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block h-5 w-1 rounded-full bg-brand-gold" />
          <h1 className="text-2xl font-bold text-neutral-900">Publishing Vault™</h1>
        </div>
        <Link href="/dashboard/create" className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
          <Plus className="h-4 w-4" /> New Book
        </Link>
      </div>

      {books.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-white/50 p-10 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold-soft">
            <FolderOpen className="h-6 w-6 text-brand-gold-dark" />
          </span>
          <p className="mt-3 text-sm font-semibold text-neutral-700">Your vault is empty</p>
          <p className="mt-1 text-sm text-neutral-500">Every book you create lands here, ready to package into a Launch Kit™.</p>
          <Link href="/dashboard/create" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-700">
            <Plus className="h-4 w-4" /> Create your first book
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {books.map((b) => {
            const meta = bookTypeMeta(b.book_type);
            const Icon = meta.icon;
            const st = STATUS[b.status] ?? { label: b.status, cls: "bg-neutral-100 text-neutral-600 border-neutral-200", dot: "#71717a" };
            const isEbook = b.book_type === "ebook";
            return (
              <li key={b.id} className="rounded-xl border border-neutral-200 bg-white p-4 shadow-card transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `${meta.tint}1a`, color: meta.tint }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-neutral-900">{b.title}</h2>
                        {b.book_metadata?.subtitle && (
                          <p className="truncate text-sm text-neutral-500">{b.book_metadata.subtitle}</p>
                        )}
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${st.cls}`}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: st.dot }} />
                        {st.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">
                      {typeLabel(b.book_type)} · {b.theme}
                      {["word_search", "sudoku", "maze", "coloring"].includes(b.book_type) ? ` · ${b.puzzle_count} puzzles` : ""}
                      {b.page_count ? ` · ${b.page_count} pages` : ""} · {new Date(b.created_at).toLocaleDateString()}
                    </p>

                    {b.status === "completed" && isEbook && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link href={`/dashboard/ebook/${b.id}`} className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"><BookOpen className="h-3.5 w-3.5" /> Open Editor</Link>
                        <a href={`/api/ebook/${b.id}/export?format=pdf`} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">PDF</a>
                        <a href={`/api/ebook/${b.id}/export?format=epub`} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">EPUB</a>
                        <a href={`/api/ebook/${b.id}/export?format=docx`} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50">DOCX</a>
                        <Link href={`/dashboard/books/${b.id}`} className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"><Package className="h-3.5 w-3.5" /> Launch Kit</Link>
                      </div>
                    )}

                    {b.status === "completed" && !isEbook && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a href={`/api/books/${b.id}/download?part=interior`} className="inline-flex items-center gap-1 rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"><FileText className="h-3.5 w-3.5" /> Interior PDF</a>
                        <a href={`/api/books/${b.id}/download?part=cover`} className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"><FileImage className="h-3.5 w-3.5" /> Cover PDF</a>
                        <Link href={`/dashboard/books/${b.id}`} className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50"><Package className="h-3.5 w-3.5" /> Launch Kit</Link>
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
