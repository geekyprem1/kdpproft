-- Artifact rows are written exclusively by trusted service-role APIs.
-- Keep owner/admin SELECT policies intact while removing direct owner mutations.

drop policy if exists "books owner insert" on public.books;
drop policy if exists "books owner update" on public.books;
drop policy if exists "books owner delete" on public.books;

drop policy if exists "covers owner insert" on public.covers;
drop policy if exists "covers owner delete" on public.covers;
