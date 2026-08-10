-- 0022_cover_v2
-- Cover Generator V2 (Beta): the image model composes the whole cover, typography
-- included. V2 reuses the covers table so the existing library, downloads, PDF
-- export and use-for-book routes keep working with no new plumbing.
--
-- Per-concept V2 fields (text_source, text_verified, verify_attempts, final_px)
-- live inside the existing concepts jsonb — no schema change needed for those.

alter table public.covers
  add column if not exists engine text not null default 'v1',
  add column if not exists design_brief jsonb;

-- Only the two engines exist; anything else is a bug, not data.
alter table public.covers drop constraint if exists covers_engine_check;
alter table public.covers add constraint covers_engine_check
  check (engine in ('v1', 'v2'));

-- The Cover Studio lists covers per user per engine, newest first.
create index if not exists covers_user_engine_idx
  on public.covers (user_id, engine, created_at desc);
