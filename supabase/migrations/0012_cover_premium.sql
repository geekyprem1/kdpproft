-- Premium Cover Generator: genre-aware concepts, trim, and per-concept metadata
-- (layout / seed / score) stored alongside the variation image keys.

alter table public.covers add column if not exists genre    text;
alter table public.covers add column if not exists trim     text default '6x9';
alter table public.covers add column if not exists concepts jsonb not null default '[]';
