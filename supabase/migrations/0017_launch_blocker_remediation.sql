-- 0017_launch_blocker_remediation
-- Phase 12A — fixes for the launch security audit.
--   C1: privilege escalation — lock privileged profile columns to service_role.
--   H1: retry credit duplication — add an idempotent refund guard to jobs.

-- ── C1: protect privileged profile columns ──
-- The "own profile update" RLS policy (0001) lets a user update their own row but
-- has no column restriction, so a user could set role='super_admin', re-activate a
-- banned account, etc. RLS WITH CHECK cannot compare to OLD, so we use a trigger:
-- any change to role/account_status/is_unlimited/plan/credits is rejected unless the
-- caller is the service role (admin client) or a direct/maintenance connection.
create or replace function public.protect_privileged_profile_columns()
returns trigger
language plpgsql
as $$
declare
  caller_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'service_role'  -- no PostgREST JWT context = direct/maintenance connection
  );
begin
  if caller_role in ('anon', 'authenticated') then
    if new.role           is distinct from old.role
       or new.account_status is distinct from old.account_status
       or new.is_unlimited   is distinct from old.is_unlimited
       or new.plan           is distinct from old.plan
       or new.credits        is distinct from old.credits then
      raise exception
        'profiles: privileged fields (role, account_status, is_unlimited, plan, credits) may only be modified by the service role'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_privileged_profile_columns on public.profiles;
create trigger protect_privileged_profile_columns
  before update on public.profiles
  for each row execute function public.protect_privileged_profile_columns();

-- ── H1: idempotent refund guard for generation jobs ──
-- Each generation attempt may refund its reserved credits at most once. The flag is
-- reset to false on retry (in lib/jobs/job-queue.ts) so a fresh attempt can refund
-- exactly once on failure, preventing both duplicate refunds and free generations.
alter table public.generation_jobs
  add column if not exists credits_refunded boolean not null default false;
