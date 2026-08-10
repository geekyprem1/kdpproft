-- Bundle Generator: one topic → multiple books (orchestrates existing generators).
-- A bundle groups several `books` rows via books.bundle_id.

create table if not exists public.bundles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  topic       text not null,
  audience    text,
  difficulty  text,
  book_types  text[] not null default '{}',
  opportunity jsonb,
  status      text not null default 'generating',  -- generating|completed|partial|failed
  created_at  timestamptz not null default now()
);
create index if not exists bundles_user_idx on public.bundles (user_id, created_at desc);

alter table public.books add column if not exists bundle_id uuid references public.bundles(id) on delete set null;
create index if not exists books_bundle_idx on public.books (bundle_id);

alter table public.bundles enable row level security;

drop policy if exists "bundles owner select" on public.bundles;
create policy "bundles owner select" on public.bundles for select using (auth.uid() = user_id);
drop policy if exists "bundles owner insert" on public.bundles;
create policy "bundles owner insert" on public.bundles for insert with check (auth.uid() = user_id);
drop policy if exists "bundles owner delete" on public.bundles;
create policy "bundles owner delete" on public.bundles for delete using (auth.uid() = user_id);
