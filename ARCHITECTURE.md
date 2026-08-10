# System Architecture

## Overview

```
Browser (Next.js · Shadcn · Tailwind)
        │ HTTPS
Next.js App (API routes + server components)
        ├── Supabase (Postgres + Auth)
        ├── Cloudflare R2 (asset/PDF storage)
        ├── Stripe (payments)         [later]
        └── Trigger.dev (background jobs)   [later]
                ├── OpenRouter (text: Gemini → DeepSeek)
                ├── Replicate FLUX (images, coloring phase)
                └── Puppeteer (PDF render)
```

## Key decisions (see DECISIONS.md)

- **Async generation** via Trigger.dev — a full book is minutes of work, too long
  for a request. DB-polling worker was rejected.
- **AI text via OpenRouter** behind a provider abstraction (Gemini primary,
  DeepSeek fallback). Claude removed. One key, many models, config-swappable.
- **Algorithmic generators first** (Word Search/Sudoku/Maze) — deterministic, no
  image cost/latency, solver-verifiable. Coloring (FLUX) deferred.
- **PDF Engine Gate** — proven against a real KDP upload before any breadth.

## PDF engine (built)

```
lib/pdf/
├─ kdp-specs.ts        # KDP math: trim, bleed, gutter-by-page-count, spine
├─ render.ts           # Puppeteer → PDF at exact physical size (browser reuse)
├─ templates/
│  ├─ interior.ts      # mirrored-margin interior pages
│  └─ cover.ts         # wraparound back│spine│front
└─ index.ts            # buildInteriorPdf / buildCoverPdf / buildGateSample
```

The engine is framework-agnostic TypeScript: callable from CLI scripts now and
from API routes / Trigger.dev tasks later. It stays generic — each generator
owns its own page HTML and calls `buildInteriorPdf` / `buildCoverPdf`.

## Word Search generator (built)

```
lib/generators/word-search/
├─ types.ts        # difficulty, directions, puzzle shape
├─ word-banks.ts   # curated theme word lists (no AI)
├─ generate.ts     # deterministic seeded puzzle generation
├─ render.ts       # puzzle + solution page HTML (InteriorPageContent)
├─ book.ts         # config → puzzles → interior + cover PDFs
└─ index.ts
```

Surfaced via `app/word-search` (form + download) and
`app/api/word-search/generate` (POST → PDF). Runs synchronously in the route
(no images, fast). `lib/util/prng.ts` provides the seeded RNG.

## Generation pipeline (target)

```
Job created
 → reserve credits (atomic)
 → build content   (algorithmic puzzles, or FLUX images later)
 → generate metadata (OpenRouter)
 → assemble pages   (HTML templates per trim/margins)
 → render PDF       (Puppeteer → interior + cover)
 → store to R2, commit credits, mark complete
 (on failure → refund credits, mark failed)
```

For the current Word Search vertical slice this runs **synchronously inside an
API route** (fast, no images). It moves into Trigger.dev when image generation
and multi-minute jobs arrive.

## AI provider abstraction (built)

```
lib/ai/
├─ types.ts        # message/result types
├─ models.ts       # primary/fallback registry + isAiConfigured()
├─ openrouter.ts   # single OpenRouter client (OpenAI-compatible)
├─ provider.ts     # primary → fallback, timeout, JSON schema-validate, log
├─ word-list.ts    # generateWordList(niche) → sanitized A–Z pool
└─ metadata.ts     # generateMetadata() → title/subtitle/description/keywords
```

Optional by design: with `OPENROUTER_API_KEY` set, any niche gets AI word lists +
metadata; without it, the app falls back to curated banks + template metadata.

## SaaS app (built — MVP)

`/login` (Supabase: Google + email magic link) → `/dashboard` (Overview, Niche
Research, Create, My Books, Download History). Auth gating in `proxy.ts`.

**Unified Create wizard** (`components/dashboard/create-wizard.tsx`) — 4 steps:
Topic → Opportunity analysis (`POST /api/opportunity` → `lib/ai/analyzeTopic`,
shared `lib/opportunity` engine) → Choose Type (Recommended/Good/Not-Recommended
badges from per-type fit) → dynamic Configure → Generate. The opportunity result
is saved as a snapshot on the book (`books.opportunity`). Storybook shows
"Coming Soon"; Ebook is configurable now and generates in Phase 9.

`POST /api/books` runs each puzzle/coloring pipeline synchronously: content →
metadata → PDF (interior + cover) → upload to storage → rows in
`books`/`book_metadata` (+ opportunity snapshot). `GET /api/books/[id]/download`
checks ownership, signs a storage URL, logs the download.

## Folder structure

```
app/            # Next.js routes (UI + API)
components/      # UI (shadcn)
lib/
  pdf/           # PDF engine (built)
  generators/    # puzzle/coloring generators
  config/        # production defaults
  supabase/      # db/auth clients (built)
  storage/       # R2 client (built)
  ai/            # OpenRouter abstraction (later)
scripts/         # gate + generator CLIs
supabase/migrations/
trigger/         # Trigger.dev tasks (later)
output/          # generated PDFs (gitignored)
```

## Risks

KDP compliance (mitigated by the gate) · Puppeteer in production (dedicated
long-running host / Trigger.dev runtime) · FLUX cost+latency for big coloring
books · structured-output reliability of Gemini/DeepSeek (enforce schema +
fallback) · credit race conditions (atomic ledger) · webhook idempotency.
