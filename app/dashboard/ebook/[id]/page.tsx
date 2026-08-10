import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { EbookEditor } from "@/components/dashboard/ebook-editor";

export const dynamic = "force-dynamic";

export default async function EbookEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: book } = await supabase
    .from("books")
    .select("id, title, book_type, book_metadata(subtitle)")
    .eq("id", id)
    .single();
  if (!book || book.book_type !== "ebook") notFound();

  const { data: chapters } = await supabase
    .from("ebook_chapters")
    .select("idx, title, content_md, word_count")
    .eq("book_id", id)
    .order("idx", { ascending: true });

  const metaArr = book.book_metadata as unknown as { subtitle: string | null }[] | null;
  const meta = metaArr?.[0] ?? null;

  return (
    <EbookEditor
      bookId={book.id}
      title={book.title}
      subtitle={meta?.subtitle ?? null}
      chapters={(chapters ?? []).map((c) => ({
        idx: c.idx,
        title: c.title,
        contentMd: c.content_md,
        wordCount: c.word_count,
      }))}
    />
  );
}
