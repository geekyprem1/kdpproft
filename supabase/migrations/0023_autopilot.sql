-- Book Autopilot: answer a few questions → 3 complete ebooks (with covers) are
-- written in the background, one after another. A run groups 3 `books` rows via
-- books.autopilot_run_id and is limited to ONCE PER CALENDAR MONTH per user.
--
-- The month cap is enforced atomically by a UNIQUE (user_id, month_bucket) index:
-- the second insert in the same month fails with a unique violation, so there is
-- no read-then-write race. `month_bucket` is 'YYYY-MM' (UTC), set by the app.

create table if not exists public.autopilot_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  niche          text not null,
  audience       text,
  author         text,
  words_per_book integer not null default 25000,
  trim_size      text not null default '6x9',
  angles         jsonb not null default '[]',   -- [{title, angle}] x3
  job_ids        uuid[] not null default '{}',
  status         text not null default 'generating',  -- generating|completed|partial|failed
  month_bucket   text not null,                  -- 'YYYY-MM' (UTC) — once-per-month lock
  created_at     timestamptz not null default now()
);

create index if not exists autopilot_runs_user_idx
  on public.autopilot_runs (user_id, created_at desc);

-- One run per user per calendar month.
create unique index if not exists autopilot_runs_user_month_uidx
  on public.autopilot_runs (user_id, month_bucket);

-- Link generated ebooks back to their Autopilot run (mirrors books.bundle_id).
alter table public.books
  add column if not exists autopilot_run_id uuid
    references public.autopilot_runs(id) on delete set null;
create index if not exists books_autopilot_run_idx
  on public.books (autopilot_run_id);

alter table public.autopilot_runs enable row level security;

drop policy if exists "autopilot owner select" on public.autopilot_runs;
create policy "autopilot owner select" on public.autopilot_runs for select using (auth.uid() = user_id);
drop policy if exists "autopilot owner insert" on public.autopilot_runs;
create policy "autopilot owner insert" on public.autopilot_runs for insert with check (auth.uid() = user_id);
drop policy if exists "autopilot owner delete" on public.autopilot_runs;
create policy "autopilot owner delete" on public.autopilot_runs for delete using (auth.uid() = user_id);
-- inserts/updates that claim the month lock happen server-side via the service role.
