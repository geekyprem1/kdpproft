# Decision Log

Architecture decisions, newest first. Each: context → decision → consequences.

## ADR-022 — Background generation: in-process jobs (Option 1)
**Context:** Generation should be async — start, leave, come back, download.
Generators must not change.
**Decision:** A `generation_jobs` table (migration `0011`) + `lib/jobs/`
(job-progress, job-runner, job-queue). `/api/books` and `/api/ebook` now
**enqueue** a job and return `{ jobId }` immediately; the wizard redirects to
`/dashboard/in-progress/[id]`. The runner executes in the **same server process**
(fire-and-forget) by dispatching to the existing pipelines
(`generateAndStoreBook` / `generateAndStoreEbook`, which gained an optional
`onProgress` callback — orchestration only). State lives in the DB, so refresh /
logout / close-browser are fine; the UI polls via `router.refresh()`.
**Recovery/retry:** `input` is persisted so any job can be re-run; queued jobs are
re-kicked on the In-Progress page (`recoverQueuedJobs`); failed/stuck jobs have a
Retry/Resume action. A `running` set prevents double execution per process.
**Atomic claim + optional worker:** jobs are claimed atomically (queued →
processing via a conditional update), so an optional standalone worker
(`npm run worker`, `scripts/worker.ts`) can run alongside the web server with no
double-execution. The worker also reclaims jobs stuck in `processing`
(`reclaimStaleJobs`) — true restart resilience without Trigger.dev. Run zero or one.
**Consequences:** Works on a single long-running server (not serverless cold-stop;
those use Retry, or run the worker). Generators untouched; Bundle stays
synchronous. Storybook (multi-minute) drops in via a new job_type + runner branch
— no architecture change.

## ADR-021 — Author/Publishing Profile inherited without touching generators
**Context:** Every book should inherit author/pen/publisher/language/trim/price/
AI-disclosure/copyright. Generators must not be modified.
**Decision:** Store the profile on the existing `profiles` row (migration `0010`).
Inherit at the orchestration layer: the shared book pipeline and `/api/ebook`
load the profile and pass `author = pen ?? author` into each generator's EXISTING
`author` option (no generator change) and store it in `books.config`. The Publish
Package pulls publisher, language, copyright, AI disclosure, and default price
from the profile into `metadata.json` (now also carrying `publisher` + `copyright`).
A `/dashboard/settings` page edits the profile via `/api/settings` (RLS "own
profile update").
**Consequences:** Real inheritance for author (on cover/title page) and all
publishing metadata, with zero generator edits. Trim/price are stored defaults;
the book's actual engine trim remains authoritative in metadata.

## ADR-020 — KDP Publish Package: stored artifacts, ZIP on demand
**Context:** Every book should yield a ready-to-publish KDP bundle without
touching the generators.
**Decision:** New `lib/publishing/` layer (keywords / categories / titles /
metadata+description / package) reusing OpenRouter. `POST /api/publish-package`
generates artifacts (7 primary + 20 long-tail keywords, 3–5 categories, 10 alt
titles, 150–400-word description, metadata.json with AI disclosure + suggested
price) and upserts one row per book (`book_publish_packages`, migration `0009`,
unique book_id). `GET /api/publish-package/[id]` builds the ZIP on demand from the
stored record + the book's assets: stored PDFs for puzzle/coloring, and for
ebooks the interior PDF is rebuilt via the existing `buildEbookPdf` (cover = PNG).
The 6 text files + checklist are derived from the stored record (no AI on
download). UI: Publishing Package section on `/dashboard/books/[id]` + a link from
My Books.
**Consequences:** Generators untouched; one package per book, always current with
stored metadata; works for all 5 book types via one type-agnostic path.

## ADR-019 — Bundle Generator orchestrates a shared book pipeline
**Context:** Generate several books from one topic without duplicating generator
or orchestration code.
**Decision:** Extract the single-book "generate + store" flow into
`lib/books/pipeline.ts` (`planBook` + `generateAndStoreBook`) — the one place that
calls the existing build* generators, metadata, storage, and DB inserts. Refactor
`/api/books` to use it (now thin). The Bundle Generator (`/api/bundle`) uses the
Opportunity Engine to recommend the best mix of the 4 puzzle/coloring types, then
loops the SAME pipeline (with a `bundle_id`) — sequentially, per-book status,
partial-success tolerant. Bundles tracked in `bundles` + `books.bundle_id`
(migration `0008`); ZIP export zips each book's stored PDFs on demand.
**Consequences:** Zero duplicate generator/orchestration code; `/api/books` and
bundles share one tested path. Recommended composition + publishing order are
data-driven from per-type fit. Ebook stays separate (its own pipeline).

## ADR-024 — KDF Mafia monetization: provider-agnostic billing
**Context:** Launch-ready SaaS needs credits, plans, subscriptions, usage, and
refunds — without coupling to any payment processor.
**Decision:** `lib/billing/` with a strict provider boundary
(`providers/` — `PaymentProvider` interface + `BaseProvider` + stubs for JVZoo /
WarriorPlus / Stripe / Dodo / LemonSqueezy; registry `getProvider`). Credits,
plans, subscriptions, usage, and refunds depend ONLY on that interface. Balance
lives on `subscriptions.credits_remaining`; `credit_transactions` is the ledger;
`usage_events` + `billing_audit_log` track usage/audit (migration `0013`).
Dynamic usage-based costs (`cost.ts`); feature gating by plan tier (`plans.ts`).
Generation flow: gate feature → compute cost → **reserve** (deduct) at enqueue →
**consume** (usage event) on success / **refund** on failure (in the job runner;
sync routes reserve+consume/refund inline). Routes map `InsufficientCreditsError`
→ 402 and `FeatureLockedError` → 403 with upgrade hints. Plan activation is
simulated via the stub provider until real checkout is wired.
**Consequences:** Swapping/adding a processor changes only `providers/`. No live
payments yet; admin actions (grant/remove/refund/changePlan) are backend functions.

## ADR-023 — Premium Cover Generator: genre layouts, concepts, scoring
**Context:** The cover module worked but wasn't a differentiator.
**Decision:** Make it genre-driven (Business / Self Help / Puzzle / Kids /
Coloring / Fiction) — each genre sets typography/palette/scrim. Generate **3
distinct concepts** = 3 layouts (Centered / Top Banner / Lower Third), each with
its own FLUX (or gradient) background + crisp typeset text. Add a heuristic
**cover score** (pngjs: title-area contrast + visual interest + completeness).
Per-concept **regenerate** (new seed, same layout, re-scored). Store concept
metadata (layout/seed/score) + genre + trim on `covers` (migration `0012`).
Add a **KDP-ready cover PDF** (front cover, full-bleed at the chosen trim) next to
PNG. History = the covers table; "use for book" unchanged.
**Consequences:** Standalone, reuses OpenRouter + FLUX + storage; generators
untouched. Old cover rows render with safe fallbacks (no genre/concepts).

## ADR-018 — Cover Generator: FLUX background + crisp typeset overlay
**Context:** Need professional KDP covers for all book types. AI image models
render garbled text, so titles can't come from the image itself.
**Decision:** Standalone `lib/cover/` module. OpenRouter builds a brief (a
background-art prompt with NO text, plus layout & typography suggestions); FLUX
Schnell (shared `lib/ai/replicate.ts`) renders 3 background variations; each is
**composited with a crisp HTML-typeset title/subtitle/author** via the Puppeteer
renderer. Smart per-type templates (puzzle = bold activity-book, ebook =
business/serif, coloring = playful). Without a Replicate token it falls back to
gradient backgrounds (still real covers). Stored in the `covers` table +
storage (migration `0007`); library + reopen; "Use for Book" sets a chosen book's
`cover_key`.
**Consequences:** Sharp titles regardless of the AI art. Reuses auth, OpenRouter,
storage; existing generators untouched. A new shared FLUX helper was added (not a
modification of the coloring/story copies).

## ADR-017 — Ebook Creator: editable chapters, sync gen, on-demand multi-format
**Context:** The Ebook Creator must differ from one-shot "KDP Master" generation —
editable, quality-controllable, multi-format.
**Decisions:**
- **Persisted, editable**: an ebook is a `books` row + ordered `ebook_chapters`
  rows (migration `0006`). Chapters can be rewritten/expanded/shortened
  individually in the editor (`/dashboard/ebook/[id]`).
- **Consistency**: chapters are written **voice-locked** (same tone/audience) and
  **outline-locked** (each told what the others cover) to avoid drift/repetition —
  the ebook analog of character consistency.
- **Synchronous generation** with bounded concurrency (no Trigger.dev yet) — text
  is fast enough (~1–3 min); async deferred until image-heavy Storybook.
- **Source-of-truth = Markdown**; exports built **on demand** from chapters:
  PDF (Puppeteer, reflowable 6×9 + TOC), EPUB3 (JSZip), DOCX (`docx`). No
  pre-stored export files — always current after edits.
- **Typographic cover** (gradient + title, rendered to PNG) — no image model
  required, so ebooks work without a Replicate token.
**Consequences:** Authors review/edit before publishing and can sell on KDP + other
stores (EPUB/DOCX). Reuses auth, storage, PDF engine, OpenRouter, Opportunity
snapshot. Verified live end-to-end.

## ADR-016 — Unified Create wizard + opportunity snapshot
**Context:** Each book type had ad-hoc fields in one toggle form; opportunity
scoring lived only in standalone Niche Research. We want one opportunity-first
create flow for all types (the differentiator from a "KDP Master" clone).
**Decision:** A 4-step wizard (Topic → Opportunity → Type → Configure → Generate).
A new `POST /api/opportunity` does **single-topic** analysis (`lib/ai/analyzeTopic`)
returning the four factors + computed Opportunity + per-type fit; Step 3 turns fit
into Recommended/Good/Not-Recommended badges (`recommendationBadge`). The analysis
is stored as a snapshot on the book (`books.opportunity`, from migration 0005).
Ebook is fully configurable now but `/api/books` returns `comingSoon` for it until
Phase 9; Storybook is shown as Coming Soon. Analysis has a neutral fallback so the
wizard works even if AI is down (with a Skip-analysis path).
**Consequences:** One flow, all types; every book carries why-it-should-sell data.
Generators/engine reused unchanged. Sets up the Ebook slot for Phase 9.

## ADR-015 — Shared Book Opportunity Engine
**Context:** Niche scoring was niche-specific (`lib/niche/score.ts`, 5 factors incl.
expansion/kdpSuitability). The product strategy needs one reusable engine for both
Niche Research and the Create flow, with the named scores Demand / Competition /
Evergreen / Monetization → Opportunity.
**Decision:** Extract `lib/opportunity/` as the shared engine. Factors collapse to
four (expansion + price potential fold into **Monetization**; KDP-suitability
folds into the recommended-type fit). `Opportunity = 0.30·Demand +
0.25·(100−Competition) + 0.15·Evergreen + 0.30·Monetization`. Recommended book
types now include **ebook** (and drop planner). `lib/niche/score.ts` and
`lib/niche/types.ts` re-export from `lib/opportunity` for back-compat. Each book
gets an `opportunity` jsonb snapshot (migration `0005`).
**Consequences:** One tunable scoring source (ADR-011 still holds: AI estimates
factors, app computes the score). Niche Research UI/PDF updated to 4 factors.
Pre-existing reports with the old factor shape render with safe fallbacks. Verified
by `npm run test:opportunity` (6/6) and a live niche run.

## ADR-014 — Coloring: FLUX line art with pixel validation + bleed
**Context:** Coloring Books are the first AI-image book type and need clean,
printable black-and-white line art that fills the page.
**Decisions:**
- **Replicate FLUX Schnell** for images (HTTP API, no SDK), seeded for
  reproducibility. Constraints (no shading/grayscale/color, white background,
  thick outlines) are baked into the positive prompt — FLUX Schnell has no
  negative-prompt param. Subjects per page come from OpenRouter (fallback to
  numbered subjects).
- **Pixel validation** (pngjs): reject gray backgrounds, large filled-black
  regions, color, and grayscale shading; retry up to 3× per page, then accept
  best effort flagged invalid.
- **Bleed = on** for coloring (the only type), via a `fullBleed` interior page
  (no margins/folio, image `object-fit: cover`). Page size = trim + bleed.
- **Offline placeholder** line art when `REPLICATE_API_TOKEN` is unset, so the
  whole pipeline (validation, PDF, tests) runs without API access or cost.
**Consequences:** Verified offline (`npm run test:coloring`, 8/8). Real sample
books need the token (`npm run coloring:samples`). Cover reused (no new cover
generator). DPI is bounded by FLUX Schnell (~1MP) — acceptable for line art;
upscaling is a later enhancement. Generation is synchronous for now; image-heavy
books are the motivation to move to Trigger.dev async later.

## ADR-013 — Maze: recursive-backtracking perfect mazes
**Context:** Maze books need solvable mazes with a single clear path, generated
deterministically.
**Decision:** Generate via iterative recursive-backtracking (a "perfect maze" —
a spanning tree), so exactly one path connects any two cells; START is top-left,
FINISH is bottom-right with open border cells. The solution is found by BFS and
rendered as an SVG overlay. Difficulty = grid size (12→30). Reuses the shared
PRNG for determinism.
**Consequences:** Every maze is solvable with one valid path by construction
(asserted at generation and in `npm run test:maze`). SVG keeps mazes crisp at any
print size. PDF/storage/download/metadata layers reused; `/api/books` and the
Create UI gained a third book type. Word Search + Sudoku unchanged.

## ADR-012 — Sudoku: dig-with-uniqueness-invariant generation
**Context:** Sudoku books must have valid puzzles, each with exactly one solution,
generated deterministically.
**Decision:** Build a full solved grid via seeded backtracking, then remove clues
one at a time, keeping a clue only if the puzzle still has exactly one solution
(`countSolutions(…, limit=2) === 1`, MRV solver). Difficulty = target clue count
(easy 40 → expert 26). The full grid is the guaranteed-unique solution.
Generation reuses the shared PRNG (`lib/util/prng.ts`) so seed → identical puzzle.
**Consequences:** Every emitted puzzle is valid + uniquely solvable by construction
(also asserted at generation time and in `npm run test:sudoku`). The PDF engine,
storage, download, and metadata layers are reused unchanged; `generateMetadata`
gained a `bookType` param and `/api/books` branches on type.

## ADR-011 — Niche scoring: AI estimates factors, app computes the score
**Context:** Niche Research needs a 0–100 opportunity score across several factors.
**Decision:** The AI returns only raw 0–100 factor estimates (demand, competition,
evergreen, expansion, KDP suitability) plus qualitative notes. The opportunity
SCORE and band (Low/Medium/High/Excellent) are computed **deterministically** in
`lib/niche/score.ts` (competition inverted, weighted sum), not by the model.
**Consequences:** Scores are consistent, explainable, and tunable in one place
without re-prompting. Ideas are re-sorted by the computed score before saving.
Reports are stored fully enriched in `niche_reports.ideas` (jsonb) so reopening
and PDF export need no recompute or re-call.

## ADR-010 — Storage: Supabase Storage for MVP, R2 later
**Context:** R2 has unlimited free egress but requires adding a payment method to
enable. For the MVP we want zero extra setup/cost.
**Decision:** Store book PDFs in a private **Supabase Storage** bucket (`books`)
via the service-role client, with short-lived signed download URLs. Put both
providers behind a provider-agnostic `lib/storage/` interface
(`isStorageConfigured` / `bookObjectKey` / `putBookPdf` / `getBookSignedUrl`);
`lib/storage/index.ts` selects the active one.
**Consequences:** No card needed now (Supabase free: 1 GB storage, 5 GB egress/mo).
Switching to R2 when customers arrive (unlimited free egress) is a one-line import
change in `index.ts` + `R2_*` env vars — no route changes.

## ADR-009 — MVP SaaS: synchronous generation, magic-link auth, optional AI
**Context:** Wrap the proven Word Search engine in a usable SaaS (auth →
create → download) before adding more book types.
**Decisions:**
- **Synchronous generation** in the `/api/books` route (no Trigger.dev yet).
  Word search has no image calls, so a book renders in seconds — async jobs add
  complexity we don't need until coloring books. `maxDuration` raised on the route.
- **Auth** via Supabase + `@supabase/ssr`: Google OAuth + **email magic link**
  (no password storage). `/dashboard` gated in `proxy.ts` (Next 16's renamed
  middleware) with a defense-in-depth check in the dashboard layout.
- **AI is optional**: OpenRouter (Gemini→DeepSeek) generates word lists + metadata
  when `OPENROUTER_API_KEY` is set; otherwise the app falls back to curated word
  banks + template metadata so the full flow still works with zero AI config.
- **Storage**: private R2 bucket; PDFs stored whole (no per-page rows yet) and
  served via short-lived signed URLs; downloads logged via service role.
**Consequences:** Fast to ship and testable without external keys. Revisit async
(Trigger.dev) when image generation lands.

## ADR-008 — Page-number footer must sit inside the safe margin
**Context:** Amazon KDP's Print Previewer rejected the first sample-book upload
with "text outside the margins" and "object outside the margins" on the interior
puzzle pages.
**Decision:** The page-number footer (folio) was absolutely positioned in the
bottom margin (bottom = ½ the margin) and spanned the full width past the gutter
margin on recto pages. Reposition it inside the safe area: bottom = margin + 0.15in,
and left/right bound to the page's actual (mirrored) margins. Verified with a
debug overlay (`scripts/debug-margins.ts`) that draws the KDP safe box over a
rendered page.
**Consequences:** Folio is comfortably inside the margins on both recto and verso.
The grid, title, and word list were already well within margins. Re-validate any
KDP rejection visually with the overlay before re-uploading.

## ADR-007 — Production defaults: 8.5×11, no-bleed, puzzle types
**Context:** Moving from the gate sample (6×9) toward production generation.
**Decision:** Default trim **8.5×11**, **no bleed**, book types Word Search /
Sudoku / Maze. Bleed support stays fully implemented but OFF by default.
**Consequences:** Puzzle books get the roomy large format buyers expect. Bleed is
enabled per-book only in the Coloring phase. Gate sample remains 6×9 (already
validated) and is independent of production defaults.

## ADR-006 — PDF Engine Gate before any generator
**Context:** KDP rejects non-compliant PDFs; this is the single biggest risk.
**Decision:** Build and validate a KDP-compliant PDF engine (interior + cover)
against a real KDP upload before building generators/billing/etc.
**Consequences:** `lib/pdf` shipped + verified first. Tagged `v0.1-pdf-gate`.
Final sign-off is the manual KDP previewer check.

## ADR-005 — Word Search first; synchronous for now
**Context:** Need a complete, shippable vertical slice with lowest risk.
**Decision:** Build Word Search first (deterministic, no images), running
synchronously inside an API route. Defer Sudoku/Maze/Coloring/billing/etc.
**Consequences:** Fast, reliable end-to-end path. Moves into Trigger.dev when
image generation / long jobs arrive.

## ADR-004 — Theme word lists: curated banks, not AI (for now)
**Context:** Word Search must be deterministic and must not depend on AI image
generation; we also want the slice to run without external API keys.
**Decision:** Generate theme word lists from curated, built-in word banks with a
seeded fallback. OpenRouter can supply arbitrary-theme words later.
**Consequences:** Fully deterministic and offline-capable. Theme coverage limited
to the bundled banks until AI text is wired in (Phase 7).

## ADR-003 — Trigger.dev for background jobs (not DB polling)
**Context:** A full book is minutes of work; needs durable, retryable, long-running
execution. Puppeteer needs a real Node runtime.
**Decision:** Use Trigger.dev for the generation pipeline. `generation_jobs`
becomes thin bookkeeping (`trigger_run_id`), not a queue.
**Consequences:** Built-in retries/checkpoints; likely removes the need for a
separate worker host (verify Puppeteer support on the runtime). Deferred until
generators need async.

## ADR-002 — AI text via OpenRouter behind a provider abstraction
**Context:** Need swappable text models; want one integration surface.
**Decision:** Route all text generation through **OpenRouter** — primary
`google/gemini-2.5-flash`, fallback `deepseek/deepseek-v4-flash` — behind an
`LLMProvider` interface with primary→fallback, retry, and schema validation.
**Consequences:** Model swaps are config-only. Enforce Zod schema on every call;
schema failure triggers fallback.

## ADR-001 — Remove Claude
**Context:** Original PRD specified Claude Sonnet for text.
**Decision:** Remove all Claude/Anthropic dependencies; replace with OpenRouter
(see ADR-002).
**Consequences:** No `@anthropic-ai/sdk`, no `ANTHROPIC_API_KEY`. PRD text updated.

---

## Open items

- **Credit pricing conflict** — PRD lists both per-page (1/page) and fixed bundles
  (e.g. 25/full coloring book). Resolve before billing: treat per-page as atomic
  cost, "full book" as a discounted bundle. *(unresolved — billing phase)*
- **OpenRouter model slugs** — confirm exact `deepseek/deepseek-v4-flash` slug in
  the OpenRouter catalog at integration time.
- **Whitelabel (OTO4) scope** — define narrowly (logo + name) for MVP.
