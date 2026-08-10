-- Author / Publishing Profile: per-user defaults inherited by every book and its
-- publish package. Stored on the existing profiles row (already RLS-protected).

alter table public.profiles add column if not exists author_name      text;
alter table public.profiles add column if not exists pen_name         text;
alter table public.profiles add column if not exists publisher_name   text;
alter table public.profiles add column if not exists language         text default 'English';
alter table public.profiles add column if not exists trim_size        text default '8.5x11';
alter table public.profiles add column if not exists default_price    numeric;
alter table public.profiles add column if not exists ai_disclosure    text;
alter table public.profiles add column if not exists copyright_notice text;
