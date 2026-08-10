# KDP Catalog Expansion — Architecture & Implementation Plan

> Design doc for adding new sellable KDP book types across three tiers. Grounded in
> the **existing** codebase patterns (no framework changes). Nothing here is built
> yet — this is the plan to turn "5 book types" into a "full KDP catalog", which is
> the core selling point for the JVZoo/WarriorPlus launch.

The three tiers, by build effort and margin:

| Tier | Theme | AI cost | Build effort | Margin |
|---|---|---|---|---|
| **Tier 1** | Low-content: journals, planners, trackers, log books | **none** (pure PDF) | Low | ~100% |
| **Tier 2** | Algorithmic puzzles/workbooks: crossword, tracing, math, dot-to-dot, scramble, cryptogram | none (algorithmic) | Low–Medium | ~100% |
| **Tier 3** | AI-powered: mixed activity books, adult coloring niches, large-print republisher | some (reuses existing image/AI) | Medium | high |

---

## 0. How a new book type plugs in (the shared spine)

Every existing generator (word_search, sudoku, maze, coloring) already follows one
path. A new **algorithmic / low-content** type reuses it end-to-end; only these
**7 integration points** change. This checklist applies to every Tier 1 & Tier 2 type.

```
1. lib/generators/<type>/            NEW  — the generator (buildXBook → {interior, cover, pageCount})
2. lib/books/pipeline.ts             EDIT — add to PipelineBookType union + a planBook() branch
3. lib/billing/cost.ts               EDIT — add CostableAction + costFor() case
4. lib/billing/plans.ts              EDIT — add Feature + FEATURE_TIER entry
5. app/api/books/route.ts            EDIT — add to TYPES + LABEL (algorithmic types share this route)
6. components/dashboard/create-wizard.tsx  EDIT — BUILDABLE, TYPE_SLUGS, STEP 4 config block, generate() payload
7. components/dashboard/nav.tsx      EDIT — GENERATORS entry (+ a redirect page app/dashboard/<type>/page.tsx)
```

Key facts that make this cheap:
- **PDF engine is done.** `buildInteriorPdf({ trim, pageCount, bleed }, pages[])` and
  `buildCoverPdf({ trim, pageCount, paper, content })` in `lib/pdf` already emit
  KDP-compliant 300 DPI PDFs with correct margins/bleed/spine (`kdp-specs.ts`).
  A new type only has to produce `InteriorPageContent[]` (`{ html, fullBleed?, showPageNumber? }`).
- **No DB migration needed.** `books.book_type` and `generation_jobs.job_type` are
  free-text (no CHECK constraint). New types insert with no schema change. Config
  lives in `books.config` (jsonb). (Storybook proved this.)
- **Jobs, credits, downloads, the vault UI, cover PDF, and the download route are
  all generic** — they work for any `book_type` automatically.
- Algorithmic types are **fast + synchronous-feeling**: they still enqueue a job
  (for consistency) but finish in seconds, unlike the image-heavy story/coloring.

`books` NOT-NULL columns a new type must supply on insert: `book_type, theme, title,
status, difficulty, puzzle_count, trim_size`. For non-puzzle types set
`puzzle_count = pageCount` (or 0) and pick a sensible `difficulty` label.

---

## TIER 1 — Low-Content Generator (journals, planners, trackers, log books)

**The single biggest-margin, lowest-effort win.** These are all the *same engine*:
a book is just **one page layout repeated N times** (plus a title page). No AI, no
algorithm — just PDF templates. One generator ships a dozen sellable products via a
`layout` parameter.

### Product catalog (all one generator)
| Layout key | Product | Page template |
|---|---|---|
| `lined` | Lined notebook / journal | ruled horizontal lines |
| `dotgrid` | Dot-grid / bullet journal | dot matrix |
| `grid` | Graph / composition notebook | square grid |
| `blank` | Sketchbook | empty page |
| `planner_daily` | Daily planner | date header + time slots + to-do + notes |
| `planner_weekly` | Weekly planner | 7-day columns + goals |
| `planner_monthly` | Monthly planner | month calendar grid |
| `habit_tracker` | Habit tracker | habit rows × day columns |
| `gratitude` | Gratitude journal | prompts + lines |
| `budget` | Budget / expense log | income/expense table |
| `password` | Password log book | alphabetized credential rows |
| `fitness_log` | Workout / food log | exercise/meal tables |
| `health_log` | Blood pressure / medication log | reading tables |
| `recipe` | Blank recipe book | ingredients + steps + notes |

### Architecture
```
lib/generators/lowcontent/
  types.ts        LowContentLayout union (the keys above); LowContentOptions { layout, pageCount, trim, title, subtitle, author, hasPageNumbers, startDate? }
  layouts.ts      one pure function per layout → returns the page HTML string
                  e.g. linedPage(spec) / dailyPlannerPage(date) / habitTrackerPage(cfg)
  registry.ts     LAYOUTS: Record<LowContentLayout, { label, pageBuilder, defaultTrim, minPages, blurb }>
  book.ts         buildLowContentBook(opts) → repeat pageBuilder × pageCount → buildInteriorPdf + buildCoverPdf
```
- **Interior:** map N pages through the chosen layout's `pageBuilder`, each an
  `InteriorPageContent`. Layouts draw with CSS/SVG in HTML (like the existing
  puzzle templates) — no images. `bleed: false`.
- **Trim:** expose `KDP_TRIM_OPTIONS` (already in `kdp-specs.ts`); 6x9 and 8.5x11
  are the low-content best-sellers. Enforce `pageCount >= 24` (KDP min; already
  enforced by `computeInterior`).
- **Cover:** `buildCoverPdf` with a simple typographic front (title/subtitle/author)
  — no AI needed, but a Cover V2 art pass can be offered as an upsell.
- **Metadata:** `generateMetadata` (existing) or a light template — planners/journals
  have predictable subtitles ("120 Pages · 6×9").

### Pipeline / billing / UI
- `PipelineBookType` gains `"lowcontent"`; `planBook()` branch validates layout +
  count and returns the `build:()` closure. Reuses `generateAndStoreBook` unchanged.
- `costFor("lowcontent")` = **1 credit flat** (no AI, no per-page cost). Cheapest item.
- `Feature "lowcontent"`, `FEATURE_TIER` = 1 (front-end / starter tier — it's the
  volume product).
- Wizard STEP 4: a **layout picker** (dropdown of the 14 products) + trim + page
  count + title. `generate()` posts `{ bookType: "lowcontent", layout, pageCount, trim }`.
- Nav: one "Journals & Planners" entry (`/dashboard/lowcontent`), or list a few
  popular ones as deep-links (`?type=lowcontent&layout=planner_weekly`).

**Effort: ~1–2 days.** Highest ROI in the whole plan.

---

## TIER 2 — Algorithmic Puzzles & Kids Workbooks

Same shape as sudoku/maze: a solver/generator produces puzzle pages, no AI. Each is
an independent generator under `lib/generators/<type>/`, wired through the 7 points.

### 2a. Crossword (`crossword`) — biggest single miss
- **Generator:** `lib/generators/crossword/` — grid-fill algorithm places words from
  a themed word list (reuse `generateWordList` from `lib/ai`, already used by word
  search) into an interlocking grid; produces numbered clues.
  - `buildCrosswordGrid(words)`: backtracking placement onto an N×N grid.
  - `buildClues(placed)`: across/down clue lists (definitions from AI or a bank).
  - Interior: one puzzle grid per page + a clue block; solutions section at the back.
- **Hardest Tier 2 item** (grid packing is non-trivial) but very high demand.
- `difficulty` controls grid size + word count. `costFor` like word_search
  (`1 + ceil(count/25)`) — clue text may use AI, so allow a small buffer.
- **Effort: ~3–4 days** (the grid algorithm is the work).

### 2b. Kids Workbooks (`tracing`, `math_practice`) — very easy, high demand
- **Letter/number tracing:** `lib/generators/tracing/` — render dotted-outline glyphs
  (A-Z, a-z, 0-9, simple words) in a large tracing font with guide lines. Pure
  CSS/SVG. Config: `set` (uppercase/lowercase/numbers/words), `pageCount`.
- **Math practice:** `lib/generators/math/` — generate addition/subtraction/
  multiplication problems (`a + b = ___`) by difficulty; grid of problems per page +
  answer key at the back. Pure arithmetic generation.
- Both are **algorithmic, no AI, ~1 day each.** Kids-workbook is a huge evergreen
  KDP category.

### 2c. Puzzle variety (`dot_to_dot`, `word_scramble`, `cryptogram`)
- `word_scramble`: shuffle letters of themed words + answer key. Trivial.
- `cryptogram`: substitution-cipher a quote/sentence + hint. Trivial.
- `dot_to_dot`: numbered points along a simple shape path; connect-the-dots. Easy
  (SVG points) — or AI-assisted from an outline for complex shapes.
- Each **~0.5–1 day.** Great for bundling into activity books (Tier 3a).

Shared: all go through `/api/books` (`TYPES` array), `generateAndStoreBook`,
`costFor` (puzzle-style), `FEATURE_TIER` 1–2.

---

## TIER 3 — AI-Powered (reuse existing engines)

Higher value, sold as premium upsells. These **compose or extend** what already ships.

### 3a. Mixed Activity Book (`activity`)
- **Idea:** one kids' book mixing maze + word search + coloring + dot-to-dot pages —
  a top KDP seller.
- **Architecture:** a *composer*, not a new generator. `lib/generators/activity/`
  calls the existing `buildMazeBook`, word-search puzzle builders, coloring page
  generator, and Tier-2 dot-to-dot, then **interleaves their `InteriorPageContent[]`**
  into one book and runs a single `buildInteriorPdf`.
- Config: which sections + how many of each. Cost = sum of the component costs
  (mirror `bundleCost` in `lib/billing/cost.ts`).
- **Effort: ~2 days** (mostly orchestration + page interleaving). No new algorithms.

### 3b. Adult Coloring niches (`coloring` variant)
- **Not a new type** — extend the existing coloring generator with adult styles
  (mandala, floral, geometric, animals) via new `ColoringStyle` values + tuned
  prompts in `lib/generators/coloring/prompt.ts`. Uses the same FLUX pipeline.
- **Effort: ~0.5 day** (prompt/style additions + UI options).

### 3c. Large-Print Republisher (`republish`)
- **Idea:** take an already-generated book and re-lay it at a larger trim
  (e.g. 6×9 → 8.5×11) / bigger font for the seniors market. Same content, **new KDP
  listing, second royalty stream from work already paid for** — pure margin.
- **Architecture:** `lib/books/republish.ts` — load the source book's `config` +
  content, re-run `buildInteriorPdf` at the new trim with a larger base font, store
  as a new `books` row linked via `config.source_book_id`. For text/puzzle books this
  is a re-render; for image books it re-flows the layout.
- Cost: low (1–2 credits, mostly re-render). `Feature` tier 3–4.
- **Effort: ~2 days** (trim/font re-flow + linking UI).

---

## Priority & build order

```
1. Tier 1  Low-Content Generator         ← DO FIRST: ~100% margin, ~1-2 days, unlocks 14 products
2. Tier 2b Kids Workbooks (tracing+math)  ← ~2 days, huge evergreen demand, trivial algorithms
3. Tier 2c Puzzle variety (scramble/cryptogram/dot-to-dot)  ← ~2 days, feeds activity books
4. Tier 3a Mixed Activity Book            ← ~2 days, composes 2b+2c+existing, strong kids seller
5. Tier 2a Crossword                      ← ~3-4 days, high demand but the grid algorithm is real work
6. Tier 3b Adult Coloring niches          ← ~0.5 day, quick style add
7. Tier 3c Large-Print Republisher        ← ~2 days, second royalty stream angle
```

### Why this order
- Tier 1 alone turns the pitch into "**14+ book types in one tool**" for almost no
  effort or cost — the single strongest funnel upgrade.
- Kids workbooks + puzzle variety are near-free algorithmically and feed the Activity
  Book composer, so 2→3a stack naturally.
- Crossword is deferred only because its grid packing is the one genuinely hard
  algorithm; everything before it is fast.

## Selling-point summary (for the sales page)
- **"Every KDP format, one dashboard"** — puzzles, coloring, journals, planners,
  trackers, kids workbooks, activity books, picture stories, ebooks, covers.
- **Zero per-book cost on low-content & algorithmic types** → you keep the margin.
- **KDP-compliant by construction** — 300 DPI, correct trim/bleed/spine on every PDF.
- **Republish once, earn twice** — large-print re-listings from existing books.

## Effort totals
- Tier 1: ~1–2 days
- Tier 2: ~6–8 days (crossword is half of it)
- Tier 3: ~4–5 days
- **All three tiers: ~2–3 focused weeks**, mostly reusing the PDF engine, job system,
  billing, and wizard already in place.
