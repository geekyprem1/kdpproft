# JVZoo Launch Funnel — 14 Offers, One-Time Only

Design memo, not implementation. Mirrors the competitor's funnel shape (1 front end +
13 OTOs) repriced under a $167 ceiling, rebuilt on KDP Mafia's existing features where
possible. See [DECISIONS.md](DECISIONS.md) for the architecture these offers build on.

## The finding that drove this

Agency is currently 5,000 credits for $197 (`lib/billing/plans.ts`). Worst case, a
buyer spends every credit on Ebook Creator (the most expensive generator per credit):
`5,000 × $0.0175 ≈ $87` in real OpenRouter + Replicate cost. At 50% JVZoo commission,
net is `$197 × 0.5 = $98.50` — leaving **~$11 of margin** before refunds, chargebacks,
or infra are even counted. The table below applies one consistent rule so this can't
happen on any tier.

## The rule: credits ≈ 8× price

Blended worst-case cost is about **$0.018/credit** (Ebook Creator's chapter cost — the
most expensive generator currently shipping; puzzles and covers run cheaper).

```
Net after 50% JVZoo commission   = price × 0.50
Cost budget (30% of net kept)    = net × 0.30
Worst-case cost per credit       = $0.018
Safe credit ceiling              ≈ price × 8
```

Every row below sits at or under `price × 8` credits.

## The 14 offers

| # | Offer | Price | Credits | 8× ceiling | Status |
|---|---|---|---|---|---|
| 1 | **KDP Mafia** (Front End) — Word Search, Sudoku, Maze, Launch Kit | $17 | 120 | 136 | ships today |
| 2 | **OTO1 — Profit Multiplier** — unlimited-feel Niche/Opportunity reports + keyword export | $47 | 320 | 376 | repackage |
| 3 | **OTO2 — Automation** — Bundle Generator + background batch queue | $67 | 480 | 536 | repackage |
| 4 | **OTO3 — Agency Deluxe** — Coloring + Premium Cover + Ebook Creator, 5 project slots | $127 | 900 | 1,016 | repackage |
| 5 | **OTO4 — KDP Income Booster Add-on** — Publish Package (keywords/categories/description) standalone | $37 | 240 | 296 | repackage |
| 6 | **OTO5 — Story Book Creator** — kids' picture books, character-consistent illustrations, 24 pages | $67 | 500 story | 536 | new — see model note below |
| 7 | **OTO6 — Credit Reload Pack** — one-time top-up, spend on any feature, priority queue. Two buttons, one page: Silver $57 / Gold $97 | $57 / $97 | 450 / 750 | 456 / 776 | one-time (was 2 subscriptions) |
| 8 | **OTO7 — Agency Basic** — 3 client slots, cover + ebook unlocked | $97 | 700 | 776 | light build |
| 9 | **OTO8 — DFY KDP Assets** — 60 pre-made interiors + covers, shared library, no generation cost | $67 | 0 (library) | — | new — build once |
| 10 | **OTO9 — ClawMate AI** — KDP coaching chatbot (niche ideas, blurb polish, policy Q&A) | $47 | 400 chat | ~9× cheaper/credit | new — thin wrapper |
| 11 | **OTO10 — TrafficPilot** — ad copy / social posts / email swipes for promoting books | $37 | 280 | 296 | new — thin wrapper |
| 12 | **OTO11 — Affiliate Empire** — DFY affiliate/JV kit: banners, swipes, promo page | $27 | 0 (static kit) | — | new — content only |
| 13 | **OTO12 — Reseller Starter** — 10 client accounts, pooled credits | $97 | 700 pooled | 776 | new — reseller role |
| 14 | **OTO13 — Reseller Master** — unlimited* client accounts, white-label branding, priority support | $167 | 1,300 pooled | 1,336 | new — reseller + whitelabel |

Full funnel value if one buyer took the higher option everywhere it's offered: **≈ $998**.
Reseller Master's "unlimited accounts" claim is fair-use, not fair-use-free — the pooled
credit balance is the actual ceiling, not the account count.

## Story Book Creator — which FLUX model, and why

Character consistency across 24 pages rules out FLUX Schnell for the pages themselves —
it has no image-conditioning input, so a text-to-image-only dragon on page 7 won't match
page 18. Needs a **reference-conditioned** model: one locked character image feeds into
every page as conditioning, not just words. Full architecture already designed in
[STORYBOOK_ARCHITECTURE.md](STORYBOOK_ARCHITECTURE.md).

| Model (Replicate) | Role in the pipeline | Est. cost/image | Credits/image |
|---|---|---|---|
| `flux-schnell` | Character reference sheet only (text-to-image, no conditioning needed yet) | ~$0.003 | 1 |
| `flux-kontext-dev` **(recommended default)** | Every page illustration + cover — open-weight, reference-conditioned, cheapest model that keeps identity locked | ~$0.025–0.03 | 2 |
| `flux-kontext-pro` | Optional "Premium render" upsell — sharper detail, better prompt adherence, same conditioning mechanism | ~$0.04 | 3 |
| `flux-kontext-max` | Cover-only splurge for the top tiers (Agency Deluxe / Reseller Master) — use sparingly, not per-page | ~$0.08 | 6 |

**Default the whole pipeline to `flux-kontext-dev`.** A 24-page book (1 reference sheet +
24 pages + cover, ~5 text calls for outline/bible/script/metadata, 20% retry buffer)
costs about **$0.90** — roughly **50 credits/book** at the same $0.018/credit rate the
rest of this funnel uses. Switching every page to `flux-kontext-pro` instead costs about
**$1.25/book (~70 credits)** — matches the estimate already in `STORYBOOK_ARCHITECTURE.md`
§8. `lib/generators/story-poc/images.ts` already reads the Kontext model from the
`STORY_KONTEXT_MODEL` env var, so dev/pro/max is a config value, not new integration work.

500 story credits at 50/book ≈ **10 books** on the default model, under the 536-credit
ceiling for a $67 OTO — or offer buyers a quality dial: same 500 credits stretch to ~10
books standard or ~7 books "Premium render," no extra SKU needed.

## New builds required (everything else is a repackage)

- **DFY KDP Assets** — one-time library of ~60 pre-generated puzzle/coloring
  interiors + covers across evergreen niches. Generation cost paid once; every buyer
  downloads the same files. Best margin item in the funnel.
- **Affiliate Empire** — static JV kit (banners, swipe emails, promo page). No AI
  calls — content work, not a feature.
- **ClawMate AI & TrafficPilot** — thin wrappers around the existing OpenRouter
  client (ADR-002): a coaching chat and a promo-copy generator. Chat turns cost a
  fraction of a full book generation.
- **Reseller role + pooling** — sub-accounts drawing from one shared credit balance.
  Extends the admin "view-as" pattern already built for support, scoped to a buyer's
  own clients.
- **White-label branding** — custom logo/name threaded into PDF exports and metadata.
  Already flagged as an open item in `DECISIONS.md` ("Whitelabel (OTO4) scope —
  define narrowly (logo + name) for MVP"). Reseller Master is that OTO.
- **Story Book Creator** — see `STORYBOOK_ARCHITECTURE.md` for the full pipeline
  design (async job, character bible, reference-conditioned illustration, PDF layout).

## Four more KDP feature ideas (not in the 14, worth considering later)

- **Low-Content Planner & Journal Generator** — planners/habit trackers/log books are
  a huge evergreen KDP category this catalog doesn't cover yet. No AI images needed;
  reuses `lib/pdf` directly, close to pure margin.
- **Trim & Large-Print Republisher** — re-lay an already-generated book at a different
  trim (e.g. 6×9 → 8.5×11 large-print). Same content, new KDP listing, a second
  royalty stream from work already paid for.
- **Global Publishing Pack (translation)** — translate an existing ebook into other
  KDP marketplace languages (DE/FR/ES/IT/JP) via the existing OpenRouter pipeline,
  republish on Amazon's other storefronts.
- **Amazon Ads Campaign Kit** — auto-generate a PPC keyword list + exact/broad/auto
  campaign structure for a published book. Pairs with TrafficPilot; pure text
  generation.

## Sales pages — launchpadjb is checkout-only

Confirmed: launchpadjb lists the product for affiliates and handles checkout/payment,
but does **not** provide a sales-page builder. Every one of the 14 offers needs its own
hosted marketing page (copy, features, price, buy button) — that page's buy button then
links out to the launchpadjb checkout URL for that specific offer.

Confirmed what launchpadjv actually provides per product: (1) upsell/downsell chaining is
configured **in their own dashboard** ("Add Product" → pick the next product to show on
accept/decline) — no redirect-chain logic needed on our side; (2) a **Direct Checkout
Link** (plain URL) per product — this is what each sales page's Buy button links to
(decided over the embeddable JS-widget alternative, to keep pages simple and free of
third-party scripts).

**Build once, fill in 14 times** — not 14 custom pages:
- One shared page template/component (reuses the dark + gold styling already on the
  homepage pricing section, `app/page.tsx`) that takes props: name, tagline, feature
  list, price, screenshots, checkout URL.
- One data file (`lib/offers.ts`) listing all 14 offers — the content already drafted in
  this document (name/blurb/price/credits) feeds directly into it.
- One dynamic route (e.g. `app/offers/[slug]/page.tsx`) that looks up the slug in the
  data file and renders the shared template — 14 URLs, one file.
- Content (final copy, screenshots, testimonials) is filled in per offer as each
  feature actually ships — a page for Story Book Creator can't have real screenshots
  until Story Book Creator exists. FE/OTO1-4/Agency Basic (already-shipping features)
  can get real pages immediately; Phase 5–7 features get their page once built.

## Open questions before build

- Which commission % actually applies at launch (this memo assumes 50%, per the
  competitor's affiliate dashboard) — confirm before locking credit numbers.
- Current live Replicate pricing for `flux-kontext-dev/pro/max` (rates above are
  estimates) — re-check before setting per-book credit costs in `costFor()`.
- Reseller pooled-credit and white-label scope — needs its own small design pass
  (extends `lib/billing/` + admin view-as, per above).

---

## Build plan — what actually has to be built, in order

Sizes are rough solo-dev effort: **S** = hours, **M** = 1–3 days, **L** = 3–7 days,
**XL** = 1–2+ weeks. Nothing below matters until Phase 0 exists — right now there is
no way to actually take a payment (`LAUNCH_READINESS.md` blocker #3).

### Phase 0 — Real money in (blocks every single offer) — **XL**

1. **JVZoo IPN webhook** — `lib/billing/providers/jvzoo.ts` is currently an empty
   stub (`class JVZooProvider extends BaseProvider {}`). Needs:
   - `app/api/webhooks/jvzoo/route.ts` — public route, **no user auth**, instead
     verifies JVZoo's POST body against your secret key (their documented IPN
     signature check).
   - A `cproditem` (JVZoo product ID) → offer mapping — a small config table or
     object, since 14 offers means 14+ product IDs to map to either `changePlan()`
     (tier offers) or `grant()` (credit-only offers like the Reload Pack).
   - Handle every JVZoo transaction type: `SALE`, `RFND` (refund → `removeCredits`
     / downgrade), `CGBK` (chargeback), `BILL` (n/a once subscriptions are gone,
     but JVZoo still sends it for legacy reasons — ignore safely).
   - `JVZOO_SECRET_KEY` env var; rotate before going live.
2. **Buyer account bridging** — JVZoo buyers pay *before* they have an app login.
   The IPN needs to find-or-create a Supabase user by `ccustemail`, then the
   thank-you-page redirect (`/claim?txn=...`) verifies the transaction and lets
   them set a password. New route + page; doesn't exist today.
3. **Turn off `BILLING_TEST_ACTIVATION`** in production once the above works —
   it's the free-plan-for-anyone hole from `LAUNCH_READINESS.md` blocker #2.

### Phase 1 — Make the billing model match "buy any combination of 14," not "pick one tier" — **M**

`lib/billing/plans.ts` today is a single ladder (`free → agency`, gated by
`tier` number) — that fits a SaaS pricing page, not a JVZoo funnel where someone
can own the Front End *and* Story Book Creator *and* Reseller Master without ever
owning Agency Deluxe. Needed:

- An **entitlements** concept alongside plan tier — either a `purchases` table
  (one row per offer bought, for stacking) or a jsonb `entitlements` column on
  `subscriptions` (`{ story_book: true, dfy_assets: true, reseller: "starter" }`).
  `canUseFeature()` needs to check entitlements OR tier, not tier alone.
- `costFor()` (`lib/billing/cost.ts`) gets two new cases: `story` (the
  reference-conditioned formula above) and `chat` (ClawMate — much cheaper per
  credit than a full book).
- 14 offer rows defined somewhere (`lib/billing/offers.ts`?) with price, credit
  grant, and which entitlement/tier it sets — this is the source of truth the
  JVZoo product-ID map in Phase 0 points into.

### Phase 2 — The genuinely new features, cheapest-to-build first

| Build | Size | What it touches |
|---|---|---|
| **Affiliate Empire** | S | No real backend — an entitlement-gated page listing static banners/swipe-copy files. Mostly a content task (write the JV kit), not code. |
| **TrafficPilot** | M | `lib/generators/traffic/` (prompt templates: ad copy, social posts, email swipes) → thin OpenRouter call, reuses `lib/ai`. One API route + one form UI. |
| **ClawMate AI** | M | `lib/ai/chat.ts` (KDP-coaching system prompt over the existing OpenRouter client), `app/api/clawmate/route.ts` credit-gated per message, a simple chat UI. |
| **DFY KDP Assets** | M | An admin script that batch-runs the *existing* puzzle/coloring generators once to build a ~60-item shared library table (`dfy_assets`), plus a gated library/download page for buyers. No new generation logic — reuses what ships today. |
| **White-label branding** | M | One field (logo/name) on `profiles` or a new `reseller_branding` row, threaded into `lib/cover` and `lib/publishing` metadata output. Scope already written down in `DECISIONS.md`. |
| **Reseller role + pooling** | L | New table linking a reseller's `user_id` to the client accounts they create; `reserve()`/`spend()` in `lib/billing/credits.ts` needs to check the parent's pooled balance when the caller is a pooled sub-account. UI reuses the admin "view-as" pattern (`lib/admin/`), scoped down to a reseller's own clients only. |
| **Story Book Creator** | **XL** | The big one — full pipeline already designed in `STORYBOOK_ARCHITECTURE.md`. Migration for `story_characters` + `story_pages` (generation_jobs already exists, ADR-022); `lib/ai/image-ref.ts` wrapping `flux-schnell` (reference sheet) + `flux-kontext-dev/pro/max` (pages, model chosen per the table above); text pipeline reusing `lib/ai`; a new `story` job-runner branch (the architecture doc already calls this out as a drop-in, no framework change); PDF assembly reusing `lib/pdf` full-bleed; `POST /api/story` + progress UI with per-page thumbnails. |

### Phase 3 — Funnel plumbing — **M/L**

- One sales page per offer with a JVZoo buy button (14 pages, mostly copy +
  layout, not logic).
- Upsell/downsell sequencing: JVZoo redirects buyer → your thank-you page →
  next OTO's JVZoo checkout URL. Configured per-product in the JVZoo dashboard,
  but each step still needs a thank-you page on your side that also finishes the
  account-claim flow from Phase 0.

### Suggested build order

**0 → 1 → (TrafficPilot, ClawMate, DFY Assets, Affiliate Empire in any order) →
Story Book Creator → Reseller + white-label → funnel pages.** Nothing sells for
real until Phase 0 is done, so that's non-negotiable first regardless of which
OTOs feel more exciting to build.
