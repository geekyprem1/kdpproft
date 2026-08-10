-- KDP publish package per book (metadata + keywords + description + categories +
-- alternative titles). The ZIP is assembled on demand from this record + the
-- book's stored assets.

create table if not exists public.book_publish_packages (
  id                 uuid primary key default gen_random_uuid(),
  book_id            uuid not null references public.books(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  metadata_json      jsonb not null default '{}',
  keywords           jsonb not null default '{}',   -- { primary:[], longTail:[] }
  description        text,
  categories         text[] not null default '{}',
  alternative_titles text[] not null default '{}',
  created_at         timestamptz not null default now(),
  unique (book_id)
);
create index if not exists publish_pkg_user_idx on public.book_publish_packages (user_id, created_at desc);

alter table public.book_publish_packages enable row level security;

drop policy if exists "publish pkg owner select" on public.book_publish_packages;
create policy "publish pkg owner select" on public.book_publish_packages
  for select using (auth.uid() = user_id);
-- writes happen server-side via the service role
