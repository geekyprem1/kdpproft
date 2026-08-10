-- JVZoo funnel: entitlements. The funnel lets a buyer own any combination of
-- the 14 offers (Front End + Story Book + Reseller ...) without climbing a
-- single plan ladder. Feature access is therefore not tier-only anymore — each
-- purchased offer can flip on specific entitlements, checked alongside the tier.
--
-- Shape: { "coloring": true, "ebook": true, "story_book": true,
--          "reseller": "master", "white_label": true }

alter table public.subscriptions
  add column if not exists entitlements jsonb not null default '{}'::jsonb;
