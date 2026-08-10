# Launch Readiness Audit

Audit only — no features added. Findings from a real code review, by severity,
plus deployment / production / security checklists.

## Remediation status (updated)

| # | Finding | Status |
|---|---|---|
| 1 | Public unmetered word-search route + page | ✅ Removed (`app/word-search`, `app/api/word-search`) |
| — | Unmetered `/api/niche` AI research (found during fix) | ✅ Now gated + 1 credit + rate-limited |
| 2 | Free self-activation of paid plans | ✅ Gated behind `BILLING_TEST_ACTIVATION=1`; 403 in prod |
| 5 | Non-atomic credit spend | ✅ Atomic SQL `spend_credits`/`add_credits` (migration `0014`), service-role only |
| 8 | Security headers + rate limiting | ✅ Headers in `next.config.mjs`; per-user rate limits on all generation routes |
| 9 | Branding inconsistency | ✅ Renamed to **KDF Mafia** + tagline across UI/metadata |
| 3 | No real payment processor | ⏳ Deferred (per instruction — don't implement payments yet) |
| 4 | Serverless vs. long jobs | ⏳ Deployment-time (use long-running host + worker) |
| 6 | Rotate exposed secrets | ⏳ Ops action before launch |
| 7 | Replicate not configured | ⏳ Set token in prod, or hide coloring/cover |

---

## 🔴 Launch blockers (must fix before public launch)

1. **Public, unauthenticated, unmetered generation.**
   `app/api/word-search/generate/route.ts` (+ public page `app/word-search/page.tsx`)
   has **no auth, no credit gating, no rate limit** — anyone can generate
   unlimited Word Search PDFs (Puppeteer = real CPU/cost) and bypass billing.
   → **Remove these, or gate behind auth + credits** like `/api/books`.

2. **Anyone can self-activate any paid plan for free.**
   `app/api/billing/activate` calls the **stub** `validatePurchase` (which just
   trusts the requested plan) then grants the plan + credits. In production this
   = free Agency plan + 100k credits for any logged-in user.
   → Disable activation unless behind a **verified provider webhook**; gate the
   route with an env flag (e.g. `BILLING_TEST_ACTIVATION=1`, off in prod).

3. **No real payment processor.** All providers are stubs → you cannot actually
   collect money yet. Monetization can't go live until at least one provider
   (JVZoo/W+/Stripe/…) is wired into `lib/billing/providers/` + a webhook that
   calls `changePlan`/`grant`. (Architecture is ready; integration is not.)

4. **Long-running routes vs. serverless limits.** Routes declare
   `maxDuration` 60–300s and background jobs run **in the web process** (Option 1).
   On Vercel/serverless these get killed (Hobby ~10s, Pro ≤60–300s, and the
   process ends after the response — background jobs die).
   → Deploy the web app to a **long-running Node host** (Railway/Render/Fly), and
   run `npm run worker` for job durability. Do **not** ship generation on plain
   serverless.

## 🟠 High

5. **Credit reserve is not atomic.** `lib/billing/credits.ts` does read-then-write
   (`credits_remaining = sub + delta`). Concurrent generations can double-spend or
   mis-credit. → Use an atomic SQL update / RPC:
   `update subscriptions set credits_remaining = credits_remaining - :cost
    where user_id = :u and credits_remaining >= :cost returning credits_remaining`
   (reject if 0 rows).

6. **Rotate exposed secrets before launch.** The OpenRouter key and Supabase
   service-role key were shared in chat/`.env.local`. They are gitignored (good)
   but should be **rotated** and set only in the host's env.

7. **Replicate not configured.** Coloring Book + Cover Studio fall back to
   placeholder/gradient art (no real AI images); these aren't sale-quality.
   → Add `REPLICATE_API_TOKEN` in prod, or hide those types until configured.

## 🟡 Medium

8. **No security headers / rate limiting.** `next.config.mjs` sets no CSP,
   `X-Frame-Options`, `Referrer-Policy`, etc.; no rate limiting on AI/generation
   endpoints (abuse + cost risk even when authed).
9. **Branding inconsistency.** Product reads "KDP Pocket AI" (nav/landing) while
   Phase 11 brand is **KDF Mafia** with tagline *"The Fastest Way to Build a KDP
   Business."* Plans say "KDF Mafia …". Pick one brand and apply consistently
   (logo, landing hero, `<title>`/metadata, emails).
10. **Bundle double-charges research.** The Bundle flow calls `/api/opportunity`
    (1 credit) for recommendation, then `/api/bundle` (sum). Minor, but document
    or fold the recommend cost in.
11. **Cancel doesn't stop a running job.** `cancel` sets status only; an in-flight
    Option-1 job keeps running. Acceptable, but the UI implies otherwise.

## 🟢 Low / polish

- Dead code in the Create wizard (unreachable ebook "result"/"comingSoon"
  branches after the redirect).
- `My Books` row meta always says "N puzzles" even for ebooks/coloring.
- Old cover rows (pre-premium) and pre-billing books render with fallbacks — fine,
  just verify.
- Landing: add social proof, pricing section, FAQ, and a clear CTA above the fold.

## ✅ What's solid (verified)

- Auth gating via `proxy.ts`; per-route `auth.getUser()` everywhere **except** the
  public word-search demo (blocker #1).
- RLS on all user tables; writes via service role only; downloads check ownership
  then sign URLs.
- Credit math, plan gating, provider abstraction (unit-checked).
- Empty + loading + error states present across dashboard pages.
- Typecheck + `next build` clean.

---

## Deployment checklist

- [ ] Deploy web app to a **long-running Node host** (not plain serverless).
- [ ] Run the job worker (`npm run worker`) as a separate process/service.
- [ ] Set all env vars on the host (see below); do **not** rely on `.env.local`.
- [ ] Run migrations `0001`–`0013` on the production Supabase project.
- [ ] Configure Supabase Auth redirect URLs for the production domain.
- [ ] Private storage bucket (`books`) exists in prod.
- [ ] Build with a patched Next.js; `npm run build` green in CI.
- [ ] Smoke test: signup → generate (each type) → download → Launch Kit.

## Production environment checklist

- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (rotated)
- [ ] `OPENROUTER_API_KEY` (rotated), primary/fallback models
- [ ] `REPLICATE_API_TOKEN` (for coloring/cover) — or hide those types
- [ ] Storage: Supabase bucket (or `R2_*` if switched)
- [ ] `OPENROUTER_SITE_URL` = production URL
- [ ] `BILLING_TEST_ACTIVATION` unset/`0` in prod (blocker #2)
- [ ] Worker tuning: `WORKER_POLL_MS`, `WORKER_CONCURRENCY`, `WORKER_STALE_MIN`

## Security review summary

- ✅ RLS owner policies on every user table; service-role only for trusted writes.
- ✅ Per-route auth (except the demo route — fix).
- 🔴 Free plan self-activation (#2); 🔴 unauthenticated demo route (#1).
- 🟠 Non-atomic credit spend (#5); rotate shared secrets (#6).
- 🟡 Add security headers + rate limiting on generation endpoints.
- ✅ Secrets are gitignored; PDFs served via short-lived signed URLs.

## Recommended fix order (next phase)

1. Remove/gate the public word-search demo (#1).
2. Env-flag the billing activation route (#2).
3. Atomic credit spend via SQL/RPC (#5).
4. Branding pass → KDF Mafia + tagline (#9).
5. Security headers + basic rate limiting (#8).
6. Wire one real payment provider + webhook (#3).
7. Deploy to long-running host + worker; rotate secrets (#4, #6).
