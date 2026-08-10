# KDP Mafia

**The Fastest Way to Build a KDP Business.**

AI-powered Amazon KDP publishing platform: research niches → generate KDP-ready
books, covers, and launch kits → publish.

---

## What's built

| Area | Status | Notes |
|---|---|---|
| PDF Engine | ✅ KDP-validated | `lib/pdf/` — 8.5×11 interior + wraparound cover |
| Word Search generator | ✅ | `lib/generators/word-search/` — deterministic, solution keys |
| Sudoku generator | ✅ | `lib/generators/sudoku/` — deterministic, unique-solution, 4 difficulties (`npm run test:sudoku`) |
| Maze generator | ✅ | `lib/generators/maze/` — deterministic recursive-backtracking, solved-path key, 4 difficulties (`npm run test:maze`) |
| Coloring Book generator | ✅ | `lib/generators/coloring/` — Replicate FLUX line art, image validation, full-bleed (`npm run test:coloring`; samples need `REPLICATE_API_TOKEN`) |
| Ebook Creator | ✅ | `lib/generators/ebook/` — outline → chapters (voice-locked) → rewrite/expand editor → typographic cover → PDF/EPUB/DOCX exports |
| Opportunity Engine + Create wizard | ✅ | `lib/opportunity/` + 4-step wizard with per-type recommendation badges |
| Cover Generator (premium) | ✅ | `lib/cover/` — 6 genre-aware layouts, 3 distinct scored concepts, AI brief + FLUX background, per-concept regenerate, history, use-for-book, PNG + KDP cover PDF |
| Bundle Generator | ✅ | one topic → multi-book bundle; reuses the shared book pipeline (`lib/books/pipeline.ts`) + Opportunity Engine; ZIP export |
| KDP Publish Package | ✅ | `lib/publishing/` — per book: metadata.json, keywords, description, categories, alt titles, checklist → ZIP (interior + cover + 6 files) |
| Author & Publishing Profile | ✅ | `/dashboard/settings` — author/pen/publisher/language/trim/price/AI-disclosure/copyright inherited by every book + publish package |
| Background generation (Book In Progress) | ✅ | `lib/jobs/` — async jobs; continue if you leave/refresh/log out; progress, timeline, retry, recovery; atomic claim + optional `npm run worker` for restart resilience |
| Monetization (KDP Mafia) | ✅ | `lib/billing/` — provider-agnostic credits/plans/subscriptions/usage/refunds; feature gating; reserve→consume/refund; Billing dashboard (`/dashboard/billing`) |
| Auth | ✅ | Supabase (Google + email magic link), `proxy.ts` gating `/dashboard` |
| Dashboard | ✅ | Overview, Niche Research, Create Book, My Books, Download History |
| Niche Research | ✅ | AI → 20 scored niches, opportunity score, recommendations, save, PDF export, one-click generate |
| Book storage | ✅ | `books`/`book_metadata`/`downloads` (Supabase) + PDFs in Supabase Storage (R2-ready) |
| OpenRouter AI | ✅ | Gemini→DeepSeek word lists + metadata (optional; bank/template fallback) |
| Trigger.dev / Sudoku / Maze / Coloring / Billing / Admin | ⏳ later | — |

## Product terminology

Premium UI names (functionality unchanged; routes in parentheses):

| UI name | Module | Route |
|---|---|---|
| Market Intelligence™ | Niche research + Opportunity Engine | `/dashboard/niche` |
| Publishing Studio | Create-book wizard | `/dashboard/create` |
| Publishing Factory™ | Bundle generator | `/dashboard/bundle` |
| Cover Studio | Cover generator | `/dashboard/cover` |
| Launch Kit™ | KDP publish package | book detail → `/dashboard/books/[id]` |
| Publishing Library | My Books | `/dashboard/books` |
| Asset Vault | Download history | `/dashboard/downloads` |

Workflow: **Research → Create → Package → Publish**.

## Running the SaaS app

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

Required services (the app degrades gracefully if some are missing):

| Service | Needed for | If unset |
|---|---|---|
| **Supabase** (URL + anon + service-role) | auth, saving books, **PDF storage** | login/dashboard/`Create` won't work |
| **OpenRouter** | word lists for *any* niche + AI metadata | falls back to curated banks + template metadata |

> PDFs are stored in **Supabase Storage** (private `books` bucket) for the MVP —
> no separate storage service or card needed. The storage layer
> (`lib/storage/`) is provider-agnostic; switching to **Cloudflare R2** later is a
> one-line change in `lib/storage/index.ts` plus the `R2_*` env vars.

Setup steps:
1. Create a Supabase project; run `supabase/migrations/*.sql` (0001 then 0002).
2. In Supabase Auth: enable Google provider and add `${SITE}/auth/callback` as a
   redirect URL; enable email.
3. Create a private R2 bucket; fill the `R2_*` vars.
4. (Optional) Add `OPENROUTER_API_KEY` for arbitrary-niche word lists.

**End-to-end flow:** `/login` → `/dashboard/create` (enter niche, difficulty,
puzzle count, title) → Generate → download interior + cover PDFs → upload to KDP.

## The PDF Engine

```
lib/pdf/
├─ kdp-specs.ts          # Amazon KDP spec math (trim, bleed, gutter, spine)
├─ render.ts             # Puppeteer → PDF at exact physical size
├─ templates/
│  ├─ interior.ts        # mirrored-margin interior pages
│  └─ cover.ts           # wraparound back|spine|front cover
└─ index.ts              # buildInteriorPdf / buildCoverPdf / buildGateSample
```

Encoded KDP rules (US paperback):
- **Trim** 6×9 (8×10, 8.5×11 also defined)
- **Bleed** 0.125" (added to outer + top + bottom when enabled)
- **Gutter** scales with page count: 0.375" (≤150pp) → up to 0.875" (≤828pp)
- **Outside margin** 0.25" (no bleed) / 0.375" (bleed)
- **Spine width** = pageCount × per-page thickness (white 0.002252" / cream 0.0025")
- Fonts embedded automatically by Chromium

## Running the gate

```bash
npm install
npm run gate:generate   # writes output/interior-6x9.pdf + output/cover-6x9.pdf
npm run gate:verify     # asserts page count + physical dimensions vs spec
```

Sample is a 100-page, 6×9, white-paper book (≥79pp so the spine carries text and
the gutter table is exercised).

## Word Search generator

A complete vertical slice: **Input → Puzzle Generation → PDF → Download**.
Deterministic (seeded), theme-based word lists, no AI image generation. Output is
8.5×11, no-bleed, with puzzle pages and a highlighted answer key.

```bash
# CLI (writes output/word-search-{interior,cover}.pdf, checks determinism)
npm run ws:generate -- Dinosaurs 20 medium
```

In the app, generate via the authenticated, credit-metered flow:
**`/dashboard/create?type=word-search`** (the old public `/word-search` demo and
its unmetered `/api/word-search/generate` endpoint were removed for launch — all
generation now requires auth + credits). (≥11 puzzles needed to clear KDP's
24-page minimum.)

### Sample books for KDP upload testing

Three production-quality books (Dinosaur / Halloween / Christmas, 83pp each) live
in [examples/](examples/README.md), all passing automated KDP validation
([examples/VALIDATION.md](examples/VALIDATION.md)). Regenerate + revalidate:

```bash
npm run examples:generate
npm run examples:validate
```

## ✅ Gate success criteria — PASSED

1. `gate:verify` passes (geometry). — **automated, passing**
2. **Amazon KDP Print Previewer accepts the interior + cover with no errors.** —
   ✅ **validated** on the 8.5×11 word search books (Approve enabled). The PDF
   engine is KDP-compliant.

### Manual KDP validation steps

1. KDP → Create → Paperback.
2. Set trim size **6×9**, paper **White**, no-bleed interior.
3. Upload `output/interior-6x9.pdf` as the manuscript.
4. Upload `output/cover-6x9.pdf` as the cover (it already includes spine + bleed
   for a 100-page book — keep the sample at 100 pages so the cover spine matches).
5. Open **Launch Previewer** and confirm: no margin/trim errors, no low-DPI
   warnings, spine elements aligned.

Once KDP accepts both files, the gate is **passed** and Word Search generation
can begin.

> ⚠️ The cover spine width is page-count specific. If you change `PAGE_COUNT` in
> `scripts/generate-sample.ts`, regenerate both PDFs together so the cover spine
> matches the interior page count.
