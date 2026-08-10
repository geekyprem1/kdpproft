-- Background generation jobs. A job wraps any generator and runs asynchronously
-- so the user can leave and come back. `input` (jsonb) holds everything needed to
-- (re)run the job; `title` is for display before the book row exists.

create table if not exists public.generation_jobs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  book_id       uuid references public.books(id) on delete set null,
  job_type      text not null,   -- word_search|sudoku|maze|coloring|ebook|storybook
  book_type     text not null,
  title         text,
  input         jsonb not null default '{}',
  status        text not null default 'queued',  -- queued|processing|completed|failed|cancelled
  progress      integer not null default 0,
  current_step  text,
  error_message text,
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists generation_jobs_user_idx on public.generation_jobs (user_id, created_at desc);
create index if not exists generation_jobs_status_idx on public.generation_jobs (status);

alter table public.generation_jobs enable row level security;

drop policy if exists "jobs owner select" on public.generation_jobs;
create policy "jobs owner select" on public.generation_jobs for select using (auth.uid() = user_id);
-- inserts/updates happen server-side via the service role (the job runner)
