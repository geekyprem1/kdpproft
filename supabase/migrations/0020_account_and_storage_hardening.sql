-- 0020_account_and_storage_hardening
-- Keep admin checks status-aware, force the default artifact bucket private, and
-- prevent authenticated clients from setting server-managed artifact keys.
-- Service-role and maintenance writes still work.

-- The application defaults to the "books" bucket. If a deployment overrides
-- SUPABASE_STORAGE_BUCKET, that custom bucket must also be private.
update storage.buckets set public = false where id = 'books';

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin')
      and account_status = 'active'
  );
$$;
grant execute on function public.is_admin() to anon, authenticated, service_role;

create or replace function public.protect_server_managed_artifact_keys()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  caller_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'service_role'
  );
begin
  if caller_role in ('anon', 'authenticated') then
    if tg_table_name = 'books' and (
      (tg_op = 'INSERT' and (new.interior_key is not null or new.cover_key is not null))
      or (tg_op = 'UPDATE' and (
        new.interior_key is distinct from old.interior_key
        or new.cover_key is distinct from old.cover_key
      ))
    ) then
      raise exception 'books: artifact keys may only be modified by the service role'
        using errcode = '42501';
    elsif tg_table_name = 'covers' and (
      (tg_op = 'INSERT' and new.variation_keys <> '{}'::text[])
      or (tg_op = 'UPDATE' and new.variation_keys is distinct from old.variation_keys)
    ) then
      raise exception 'covers: variation keys may only be modified by the service role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_server_managed_artifact_keys on public.books;
create trigger protect_server_managed_artifact_keys
  before insert or update on public.books
  for each row execute function public.protect_server_managed_artifact_keys();

drop trigger if exists protect_server_managed_artifact_keys on public.covers;
create trigger protect_server_managed_artifact_keys
  before insert or update on public.covers
  for each row execute function public.protect_server_managed_artifact_keys();