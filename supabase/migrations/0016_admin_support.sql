-- 0016_admin_support
-- Phase 12 — Admin & Support Center.
--   * Roles + account status on profiles (user|admin|super_admin, active|suspended|banned|deleted)
--   * is_admin() security-definer helper for additive admin RLS read policies
--   * Support tickets + threaded replies (attachments as jsonb)
--   * admin_audit_log — every privileged admin action is recorded
-- All admin WRITES happen server-side via the service-role client after the app
-- verifies the caller is an admin; the RLS policies below are additive read access
-- (defense in depth) and the user-facing support surface.

-- ── Roles + account status on profiles ──
alter table public.profiles add column if not exists role           text not null default 'user';     -- user|admin|super_admin
alter table public.profiles add column if not exists account_status text not null default 'active';   -- active|suspended|banned|deleted
alter table public.profiles add column if not exists status_reason  text;
alter table public.profiles add column if not exists status_changed_at timestamptz;

create index if not exists profiles_role_idx on public.profiles (role) where role <> 'user';
create index if not exists profiles_status_idx on public.profiles (account_status) where account_status <> 'active';

-- ── Admin check helper (security definer → bypasses RLS internally, no recursion) ──
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ── Support tickets ──
create table if not exists public.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  subject      text not null,
  category     text not null default 'general',   -- general|billing|technical|account|feature_request|bug
  priority     text not null default 'normal',     -- low|normal|high|urgent
  status       text not null default 'open',        -- open|pending|answered|closed
  attachments  jsonb not null default '[]',         -- [{ name, key, size }]
  last_reply_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, last_reply_at desc);

-- ── Threaded replies ──
create table if not exists public.support_ticket_replies (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.support_tickets(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  author_role text not null default 'user',          -- user|admin (display side)
  body        text not null,
  attachments jsonb not null default '[]',
  created_at  timestamptz not null default now()
);
create index if not exists support_replies_ticket_idx on public.support_ticket_replies (ticket_id, created_at asc);

-- ── Admin audit log (all privileged actions) ──
create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_email text,
  action      text not null,           -- grant_credits|remove_credits|change_plan|suspend|ban|unban|soft_delete|retry_job|delete_job|delete_book|ticket_reply|ticket_status|...
  target_type text,                    -- user|job|book|ticket|subscription
  target_id   text,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists admin_audit_actor_idx on public.admin_audit_log (actor_id, created_at desc);
create index if not exists admin_audit_target_idx on public.admin_audit_log (target_type, target_id, created_at desc);

-- ───────────────────────────── RLS ─────────────────────────────

-- profiles: keep existing owner policies; add additive admin read.
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles for select using (public.is_admin());

-- books / generation_jobs: additive admin read (admin pages otherwise use service role).
drop policy if exists "admins read all books" on public.books;
create policy "admins read all books" on public.books for select using (public.is_admin());

drop policy if exists "admins read all jobs" on public.generation_jobs;
create policy "admins read all jobs" on public.generation_jobs for select using (public.is_admin());

-- subscriptions / usage / billing audit: additive admin read.
drop policy if exists "admins read all subs" on public.subscriptions;
create policy "admins read all subs" on public.subscriptions for select using (public.is_admin());

drop policy if exists "admins read all usage" on public.usage_events;
create policy "admins read all usage" on public.usage_events for select using (public.is_admin());

drop policy if exists "admins read all billing audit" on public.billing_audit_log;
create policy "admins read all billing audit" on public.billing_audit_log for select using (public.is_admin());

-- support_tickets: owner CRUD-lite + admin read. Status/admin writes via service role.
alter table public.support_tickets enable row level security;
drop policy if exists "tickets owner select" on public.support_tickets;
create policy "tickets owner select" on public.support_tickets for select using (auth.uid() = user_id);
drop policy if exists "tickets admin select" on public.support_tickets;
create policy "tickets admin select" on public.support_tickets for select using (public.is_admin());
drop policy if exists "tickets owner insert" on public.support_tickets;
create policy "tickets owner insert" on public.support_tickets for insert with check (auth.uid() = user_id);

-- support_ticket_replies: visible to ticket owner + admins; owner can append.
alter table public.support_ticket_replies enable row level security;
drop policy if exists "replies select" on public.support_ticket_replies;
create policy "replies select" on public.support_ticket_replies for select using (
  public.is_admin() or exists (
    select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()
  )
);
drop policy if exists "replies owner insert" on public.support_ticket_replies;
create policy "replies owner insert" on public.support_ticket_replies for insert with check (
  author_id = auth.uid() and exists (
    select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()
  )
);

-- admin_audit_log: admin read only. Inserts via service role.
alter table public.admin_audit_log enable row level security;
drop policy if exists "audit admin select" on public.admin_audit_log;
create policy "audit admin select" on public.admin_audit_log for select using (public.is_admin());
