-- 0025_dfy_assets
-- OTO2 — Done-For-You (DFY) Edition.
--   * dfy_assets — a catalog of ready-to-publish downloadables (interiors, covers,
--     bundles) that admins upload and DFY buyers download.
-- Access model: buyers are gated by the `dfy_assets` entitlement on their
-- subscription (checked server-side). Files live in the private storage bucket
-- under the `dfy/` prefix and are served via short-lived signed URLs. All writes
-- happen server-side via the service-role client after an admin check; the RLS
-- policy below is additive admin read (defense in depth). User reads are done
-- server-side (service role) only after the entitlement check passes.

create table if not exists public.dfy_assets (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null default 'general',   -- puzzle|coloring|lowcontent|workbook|bundle|general
  description   text,
  file_key      text not null,                       -- storage object key (dfy/<id>/<file>)
  file_name     text not null,                       -- original download filename
  file_size     bigint not null default 0,
  content_type  text not null default 'application/pdf',
  cover_key     text,                                -- optional preview/thumbnail object key
  is_published  boolean not null default true,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists dfy_assets_category_idx on public.dfy_assets (category, created_at desc);
create index if not exists dfy_assets_published_idx on public.dfy_assets (is_published) where is_published;

-- ── RLS ──
alter table public.dfy_assets enable row level security;

-- Additive admin read (admin pages otherwise use the service-role client).
drop policy if exists "dfy admin select" on public.dfy_assets;
create policy "dfy admin select" on public.dfy_assets for select using (public.is_admin());

-- Note: user-facing reads are performed server-side with the service-role client
-- only after the caller's `dfy_assets` entitlement is verified, so no broad
-- authenticated read policy is granted here. All writes are service-role only.
