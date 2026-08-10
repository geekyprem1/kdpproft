-- ───────────────────────────────────────────────────────────────
-- Books, metadata, and download history for the Word Search MVP.
-- Synchronous generation (no jobs table yet). PDFs live in R2; we store
-- the object keys here and sign URLs on download.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.books (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  book_type     text not null default 'word_search',
  theme         text not null,
  title         text not null,
  status        text not null default 'generating',  -- generating|completed|failed
  -- config
  difficulty    text not null default 'medium',
  puzzle_count  integer not null,
  page_count    integer,
  trim_size     text not null default '8.5x11',
  word_source   text,                                 -- 'ai' | 'bank'
  config        jsonb not null default '{}',
  -- R2 object keys (private bucket; signed on download)
  interior_key  text,
  cover_key     text,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists books_user_idx on public.books (user_id, created_at desc);

create table if not exists public.book_metadata (
  book_id          uuid primary key references public.books(id) on delete cascade,
  title            text,
  subtitle         text,
  description      text,
  keywords         text[] default '{}',
  backend_keywords text[] default '{}',
  generated_by     text,                              -- model id or 'template'
  created_at       timestamptz not null default now()
);

create table if not exists public.downloads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  part        text not null,                          -- interior|cover
  created_at  timestamptz not null default now()
);
create index if not exists downloads_user_idx on public.downloads (user_id, created_at desc);

-- ── RLS ──
alter table public.books enable row level security;
alter table public.book_metadata enable row level security;
alter table public.downloads enable row level security;

-- books: owner full access
drop policy if exists "books owner select" on public.books;
create policy "books owner select" on public.books for select using (auth.uid() = user_id);
drop policy if exists "books owner insert" on public.books;
create policy "books owner insert" on public.books for insert with check (auth.uid() = user_id);
drop policy if exists "books owner update" on public.books;
create policy "books owner update" on public.books for update using (auth.uid() = user_id);
drop policy if exists "books owner delete" on public.books;
create policy "books owner delete" on public.books for delete using (auth.uid() = user_id);

-- book_metadata: readable/owned through the parent book
drop policy if exists "metadata owner select" on public.book_metadata;
create policy "metadata owner select" on public.book_metadata for select
  using (exists (select 1 from public.books b where b.id = book_id and b.user_id = auth.uid()));

-- downloads: owner read; inserts happen server-side (service role)
drop policy if exists "downloads owner select" on public.downloads;
create policy "downloads owner select" on public.downloads for select using (auth.uid() = user_id);
