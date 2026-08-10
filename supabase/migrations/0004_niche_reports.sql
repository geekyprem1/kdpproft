-- ───────────────────────────────────────────────────────────────
-- Niche Research reports. Each row is one research run (a keyword + filters)
-- with up to ~20 AI-generated niche ideas stored as JSON (each idea carries its
-- factor scores, computed opportunity score, band, and book recommendations).
-- ───────────────────────────────────────────────────────────────

create table if not exists public.niche_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  keyword     text not null,
  audience    text,
  category    text,
  country     text,
  model       text,            -- which OpenRouter model produced it
  ideas       jsonb not null default '[]',
  created_at  timestamptz not null default now()
);
create index if not exists niche_reports_user_idx
  on public.niche_reports (user_id, created_at desc);

alter table public.niche_reports enable row level security;

drop policy if exists "niche owner select" on public.niche_reports;
create policy "niche owner select" on public.niche_reports
  for select using (auth.uid() = user_id);

drop policy if exists "niche owner insert" on public.niche_reports;
create policy "niche owner insert" on public.niche_reports
  for insert with check (auth.uid() = user_id);

drop policy if exists "niche owner delete" on public.niche_reports;
create policy "niche owner delete" on public.niche_reports
  for delete using (auth.uid() = user_id);
