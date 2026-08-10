-- Ebook chapters. An ebook is a `books` row (book_type='ebook') + ordered
-- chapter rows. Exports (PDF/EPUB/DOCX) are built on demand from these rows.

create table if not exists public.ebook_chapters (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references public.books(id) on delete cascade,
  idx         integer not null,
  title       text not null,
  summary     text,
  content_md  text not null default '',
  word_count  integer not null default 0,
  status      text not null default 'pending',  -- pending|written|failed
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (book_id, idx)
);
create index if not exists ebook_chapters_book_idx on public.ebook_chapters (book_id, idx);

alter table public.ebook_chapters enable row level security;

-- read/own via the parent book
drop policy if exists "ebook ch owner select" on public.ebook_chapters;
create policy "ebook ch owner select" on public.ebook_chapters for select
  using (exists (select 1 from public.books b where b.id = book_id and b.user_id = auth.uid()));
-- writes happen server-side via the service role
