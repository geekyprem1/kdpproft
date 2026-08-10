# Database Schema

PostgreSQL (Supabase). `auth.users` is managed by Supabase Auth; everything below
lives in `public`. RLS is enabled on all user-owned tables.

## Status

| Table | Status | Migration |
|---|---|---|
| `profiles` | ✅ built | `supabase/migrations/0001_foundation.sql` |
| `credit_transactions` | ✅ built | `0001_foundation.sql` |
| `books` | ✅ built | `0002_books.sql` |
| `book_metadata` | ✅ built | `0002_books.sql` |
| `downloads` | ✅ built | `0002_books.sql` |
| `niche_reports` | ✅ built | `0004_niche_reports.sql` |
| `book_pages` | ⏳ planned | (not needed yet; PDFs stored whole in R2) |
| `generation_jobs` | ⏳ planned | with Trigger.dev jobs |
| `orders` | ⏳ planned | with billing |
| `templates` | ⏳ planned | with templates (OTO3) |

## Built (Phase 0)

### profiles (1:1 with auth.users)
`id, email, full_name, avatar_url, credits (cached balance), plan, is_unlimited,
commercial_license, created_at, updated_at`
- Auto-created on signup via `handle_new_user()` trigger.
- RLS: owner can read/update own row.

### credit_transactions (append-only ledger — source of truth)
`id, user_id, amount (+grant/-spend), reason, ref_type, ref_id, balance_after,
created_at`
- Balance = `sum(amount)`; `profiles.credits` is a cache.
- RLS: owner reads own rows. Writes via **service-role only**.

## Planned

### books
`id, user_id, book_type, niche, theme, status (draft|generating|completed|failed),
page_count, trim_size, age_group, difficulty, config jsonb,
interior_pdf_url, cover_pdf_url, cover_image_url, created_at, updated_at`

### book_pages
`id, book_id, page_number, page_type (content|solution|cover|title|intro),
asset_url, prompt, payload jsonb, unique(book_id, page_number, page_type)`

### book_metadata
`book_id (pk), title, subtitle, description, keywords[], backend_keywords[],
categories[], author_name`

### generation_jobs (thin — Trigger.dev is the queue)
`id, book_id, user_id, status, trigger_run_id, current_step, progress,
credits_reserved, attempts, error, started_at, finished_at`

### orders
`id, user_id, provider (stripe|jvzoo|warriorplus), external_id, product,
amount_cents, status, credits_granted, raw jsonb`
- `unique(provider, external_id)` for webhook idempotency.

### templates (OTO3)
`id, name, book_type, niche, preview_url, config jsonb, is_premium`

## Integrity rules

- Credit spend via an atomic Postgres function (`select ... for update` on the
  profile row → balance check → ledger insert → cache update) to prevent
  double-spend.
- Reserve-then-commit credits around generation; refund on failure.
