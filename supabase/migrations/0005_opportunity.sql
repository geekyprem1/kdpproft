-- Book Opportunity Engine: snapshot the engine output on each book at creation
-- time (demand/competition/evergreen/monetization + opportunity + band +
-- recommended types). Nullable; populated by the Create flow.
alter table public.books add column if not exists opportunity jsonb;
