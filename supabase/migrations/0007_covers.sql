-- Cover Generator library. Each row = one generation (a brief + 3 variation
-- images stored in storage). Standalone — does not touch existing generators.

create table if not exists public.covers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  subtitle      text,
  author        text,
  book_type     text,
  genre         text,
  mood          text,
  art_style     text,
  audience      text,
  image_prompt  text,
  layout        text,
  typography    text,
  model         text,
  variation_keys text[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists covers_user_idx on public.covers (user_id, created_at desc);

alter table public.covers enable row level security;

drop policy if exists "covers owner select" on public.covers;
create policy "covers owner select" on public.covers for select using (auth.uid() = user_id);
drop policy if exists "covers owner insert" on public.covers;
create policy "covers owner insert" on public.covers for insert with check (auth.uid() = user_id);
drop policy if exists "covers owner delete" on public.covers;
create policy "covers owner delete" on public.covers for delete using (auth.uid() = user_id);
