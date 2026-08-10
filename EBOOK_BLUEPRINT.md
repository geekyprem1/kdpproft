# Opportunity Engine, Unified Create & Ebook Creator — Blueprint

> **Design only. No implementation yet.** This blueprint defines (1) a reusable
> Book Opportunity Engine, (2) a unified Create-Book experience, (3) a complete
> Ebook Creator PRD that is **deliberately different from a generic "KDP Master"
> clone**, plus the architecture, DB, UI flows, and implementation plan.

Already shipped: Word Search · Sudoku · Maze · Coloring Book · Niche Research ·
KDP PDF Engine · Auth + Dashboard + Storage.

---

## 0. Strategic positioning — why this is NOT a KDP Master clone

Typical "KDP Master"-style tools: **one-click, blind generation** of low-content
books, PDF-only, spammy auto-metadata, no quality control. Amazon KDP is actively
penalizing exactly that. Our wedge is to be the opposite on three pillars:

1. **Opportunity-first** — we tell users *what to publish and why* (validated
   demand/competition/profit) **before** generating, and recommend the *best book
   type* for each niche. Generation is downstream of a sell-through decision.
2. **Quality & KDP-compliance** — editable, chapter-level rewrite/expand, an
   originality/quality gate, and a "KDP readiness" check (metadata hygiene,
   content depth) so books are less likely to be rejected or buried.
3. **Ownership & multi-format** — export **PDF + EPUB + DOCX**, so authors can
   sell on KDP *and* Gumroad/Apple/Kobo/their own site. Not locked to one channel.

Everything below serves these three pillars.

---

## 1. Book Opportunity Engine

A single reusable engine (refactor of today's `lib/niche/score.ts` →
`lib/opportunity/`) that powers both standalone **Niche Research** and the inline
**Create-Book** recommendation. The AI supplies raw factor estimates; **scores are
computed deterministically** (consistent, tunable, explainable — see ADR-011).

### Scores (all 0–100)
| Score | Meaning | Source |
|---|---|---|
| **Demand** | how many shoppers want this | AI estimate |
| **Competition** | market saturation (higher = worse) | AI estimate |
| **Evergreen** | year-round vs. one-off / seasonal | AI estimate |
| **Monetization** | price ceiling × series/expansion × upsell potential | AI estimate |
| **Opportunity** (composite) | overall attractiveness | computed |

```
Opportunity = 0.30·Demand + 0.25·(100 − Competition) + 0.15·Evergreen + 0.30·Monetization
Bands: 0–39 Low · 40–59 Medium · 60–79 High · 80–100 Excellent
```

### Recommended Book Types (the differentiator)
The engine maps each niche to the **best-fit formats we can produce**, ranked with
a one-line rationale:
- Knowledge / how-to / self-help / informational → **Ebook**
- Themed / kids / gift / seasonal / relaxation → **Word Search / Coloring**
- Logic / brain-training / adult activity → **Sudoku / Maze**
- Kids narrative / moral → **Storybook** (future)

Output per niche: `{ demand, competition, evergreen, monetization, opportunity,
band, recommendedTypes: [{type, fit:0-100, why}] }`.

### Where it's used
- **Niche Research** page (already live) — upgraded to the shared engine.
- **Create Book** wizard — when a niche is entered, show its Opportunity badge +
  recommended type before the user commits.
- **Stored as a snapshot** on every book (`books.opportunity` jsonb) so we can
  later report "books you made from High/Excellent niches" and learn.

---

## 2. Unified "Create Book" experience

Replace the current type-toggle form with a **4-step wizard** that works
identically for all formats and folds in opportunity intelligence.

```
Step 1 — START
   ┌─ "From a niche idea"  → enter topic → Opportunity Engine runs
   │     → shows Demand/Competition/Evergreen/Monetization + Opportunity badge
   │     → recommends best book type(s)
   └─ "I know what I want"  → skip to Step 2
        (also entered here from Niche Research "Create →" one-click)

Step 2 — CHOOSE TYPE
   Word Search · Sudoku · Maze · Coloring · Ebook · (Storybook: coming soon)
   Recommended type(s) badged "★ Recommended for this niche"

Step 3 — CONFIGURE (type-specific panel)
   puzzles → difficulty/count · coloring → age/style/pages
   ebook → audience/tone/length/chapter count/outline-edit

Step 4 — GENERATE → progress → RESULT
   downloads (PDF always; + EPUB/DOCX for ebook) · "view in My Books"
```

One wizard, one `POST /api/books` contract (already type-branched), one result
screen. New types slot in as a Step-2 option + a Step-3 panel. UI flow in §7.

---

## 3. Ebook Creator — PRD (different from KDP Master)

### Vision
Turn a *validated topic* into a **well-structured, edited, multi-format ebook** an
author is proud to sell — not a 5,000-word AI dump. The author stays in control:
review the outline, regenerate/expand any chapter, then export to 3 formats.

### Target users
KDP non-fiction/how-to/self-help publishers, course creators, coaches,
side-hustlers who want sellable info products (KDP + other stores).

### Differentiated workflow (the core of "not a clone")
```
Topic → Opportunity check → AI Outline (EDITABLE) → per-chapter Writing
      → review · Rewrite/Expand any chapter → Quality/KDP gate
      → Metadata + Cover → Export PDF / EPUB / DOCX
```
KDP Master generates the whole book in one blind shot. We make it a **guided,
editable pipeline** with quality gates and multi-format output.

### Features (required + value-adds)
| Feature | Notes |
|---|---|
| **Topic Research integration** | start from Niche Research or type a topic |
| **Opportunity Score integration** | Opportunity badge + recommended angle before writing |
| **AI Outline Generator** | structured chapters + sections + learning objectives; **fully editable** (reorder, rename, add/remove) before writing |
| **Chapter Writer** | writes each chapter to a target length, consistent **voice/persona lock** + outline-locked to avoid drift/repetition (the ebook analog of character consistency) |
| **Rewrite / Expand chapter** | per-chapter regenerate, expand, shorten, change tone, "make more actionable" |
| **Metadata Generator** | title, subtitle, description, 7 keywords, **2 KDP categories**, A+ bullet suggestions |
| **Cover Generator** | AI background (FLUX) + typeset title/subtitle/author overlay → front cover (and KDP wraparound via existing engine) |
| **PDF export** | reflowable 6×9 interior via the existing KDP PDF engine + TOC |
| **EPUB export** | reflowable EPUB3 (XHTML + nav + OPF) for Apple/Kobo/Google |
| **DOCX export** | editable Word file authors can hand-edit / submit elsewhere |
| ★ **Quality & KDP-readiness gate** | originality/repetition check, reading-level, min depth per chapter, metadata-hygiene check (no keyword stuffing) |
| ★ **Voice/persona presets** | "friendly coach", "expert", "concise" — consistent across chapters |
| ★ **Series planner** | suggest a 3–5 book series around a winning niche |
| ★ **Front/back matter** | title page, TOC, intro, conclusion, author bio, CTA / lead-magnet page |

### Content model
- Ebook = `books` row (`book_type='ebook'`) + ordered `ebook_chapters` rows.
- Chapter content authored as **Markdown** (clean, portable) → rendered to
  HTML for PDF, XHTML for EPUB, and converted for DOCX. One source, three formats.

### Non-goals (for v1)
Storybook, audiobook, billing/credits, agency, fiction/novels (focus on
non-fiction/how-to where structure + quality win).

### Success metrics
- Outline accepted with ≤2 edits; ≥80% chapters kept without full rewrite;
  all 3 export formats valid; ebook from a High/Excellent niche; KDP-readiness
  gate pass before export.

---

## 4. Features that make us more valuable than KDP Master (for publishers)

| Capability | KDP Master (typical) | KDP Pocket AI |
|---|---|---|
| Decide *what* to publish | ❌ blind | ✅ Opportunity Engine + recommended type |
| Research → Create handoff | ❌ | ✅ one-click niche → pre-filled outline |
| Editable before/after generation | ❌ one-shot | ✅ editable outline + per-chapter rewrite/expand |
| Quality / anti-spam gate | ❌ | ✅ originality, depth, reading-level, metadata hygiene |
| Output formats | PDF only | ✅ PDF + EPUB + DOCX |
| Sell beyond Amazon | ❌ | ✅ multi-format ownership |
| Consistency | ❌ drifts | ✅ voice lock (ebook) / character lock (storybook) |
| Metadata depth | basic | ✅ keywords + categories + A+ suggestions |
| Series/scale | ❌ | ✅ series planner from winning niches |
| Trust/transparency | ❌ | ✅ shows why a niche/book will sell |

---

## 5. Updated Architecture (additions)

```
lib/opportunity/         ← refactor of lib/niche/score.ts (shared engine)
  score.ts  types.ts  recommend.ts   (factor→score, bands, type recommendation)

lib/ai/
  outline.ts             ← ebook outline (structured, editable)
  chapter.ts             ← chapter writer + rewrite/expand (voice-locked)
  quality.ts             ← originality/depth/reading-level/metadata gate
  cover.ts               ← cover copy + layout direction
  (image-ref.ts)         ← FLUX cover background (reuses Replicate)

lib/generators/ebook/
  book.ts                ← assemble chapters → interior
  render.ts              ← chapter HTML (PDF), XHTML (EPUB)
  index.ts

lib/export/
  pdf.ts                 ← reuses lib/pdf (reflowable 6×9 + TOC)
  epub.ts                ← EPUB3 builder (zip: OPF + nav + XHTML)
  docx.ts                ← DOCX builder (docx lib)

lib/cover/               ← Cover Generator (AI bg + typeset overlay → front + wraparound)

trigger/ (Trigger.dev)   ← async job for multi-chapter writes (introduced here)
```

Reused unchanged: Auth + `proxy.ts`, dashboard, `lib/storage` (Supabase→R2),
`lib/pdf` engine, `lib/ai` provider (Gemini→DeepSeek), `books`/`book_metadata`/
`downloads`. **Ebook is the second async type** (long multi-chapter writes) — it
shares the `generation_jobs` + Trigger.dev infra designed for Storybook.

New external libs (proposed): a DOCX builder (`docx`), an EPUB builder (small,
or hand-rolled zip). No new model providers (Gemini text + FLUX image already in).

---

## 6. Database Changes (proposed migrations — not applied)

```
-- 0005_opportunity: snapshot the engine output on every book
alter table public.books add column opportunity jsonb;   -- {demand,competition,evergreen,monetization,opportunity,band,recommendedTypes}

-- 0006_jobs (shared async infra, also used by Storybook)
generation_jobs(id, book_id, user_id, status, current_step, progress,
                trigger_run_id, attempts, error, started_at, finished_at, created_at)

-- 0007_ebook
ebook_chapters(id, book_id→books, idx, title, summary, content_md, word_count,
               status /* pending|written|edited|failed */, attempts, error,
               unique(book_id, idx))

book_files(id, book_id→books, format /* pdf|epub|docx|cover */, key, bytes,
           created_at)   -- multi-format exports in storage
```
- `books.book_type='ebook'`; `books.config` holds `{audience, tone, voice,
  targetWords, chapterCount}`.
- RLS: owner-only on `ebook_chapters` / `book_files` (via parent book); job/file
  writes via service role.
- `niche_reports.ideas` keeps storing the engine output (now from the shared
  `lib/opportunity`).

---

## 7. UI Flow Diagrams

**Unified Create wizard**
```
[Start] ──"from niche"──► [Opportunity result: scores + recommended type] ──►┐
   └────"I know what I want"──────────────────────────────────────────────►[Choose Type]
[Choose Type: WS·Sudoku·Maze·Coloring·Ebook] ──► [Configure (type panel)] ──► [Generate ▸ progress] ──► [Result: downloads]
```

**Ebook editor (the differentiated screen)**
```
┌ Outline ───────────────┐   ┌ Chapter view ───────────────────────────┐
│ 1. Intro        ✓ done │   │  Title: "Chapter 3 — …"                  │
│ 2. Basics       ✓ done │   │  [ generated chapter text … ]            │
│ 3. Deep dive  ✎ editing│──►│  [Rewrite] [Expand] [Shorten] [Tone ▾]   │
│ 4. …            ⏳ queued│   │  status · word count · quality score    │
│ [+ add chapter]        │   └──────────────────────────────────────────┘
└────────────────────────┘   [Export ▾  PDF · EPUB · DOCX]   [KDP-readiness ✓/✗]
```

**Research → Create handoff**
```
Niche Research card ──"Create Ebook"──► Create wizard (Step 3, outline pre-seeded
                                         from the niche + opportunity snapshot)
```

---

## 8. Implementation Plan (phased — when approved)

1. **Opportunity Engine refactor** — extract `lib/opportunity/` from
   `lib/niche/score.ts`; add Monetization + recommended-type mapping; repoint
   Niche Research to it; add `books.opportunity` snapshot. *(Low risk, high reuse.)*
2. **Unified Create wizard** — wrap the existing type form in the 4-step flow;
   add the opportunity step + type recommendations. Puzzle/coloring unchanged.
3. **Async infra** — `generation_jobs` + Trigger.dev (shared with Storybook).
4. **Ebook text pipeline** — outline → chapter writer (voice-locked) →
   rewrite/expand; per-chapter rows + status; testable with fixtures offline.
5. **Ebook editor UI** — outline + chapter view + rewrite/expand + progress.
6. **Quality/KDP gate** — originality/depth/reading-level/metadata checks.
7. **Exports** — PDF (reuse engine + TOC) → EPUB3 → DOCX; `book_files` storage.
8. **Cover Generator** — AI background + typeset overlay → front + wraparound.
9. **Validation suite + one real end-to-end ebook**; series planner as a fast-follow.

**Sequencing rationale:** the Opportunity Engine + unified Create are quick,
high-leverage, and make *every* type better immediately — do them first. The
ebook itself starts with text quality (the hard part), then editor, then the
"easy but laborious" exports, then cover.

---

## 9. Cost, Time & Risks (brief)

- **Cost / ebook** (~10 chapters × ~1,200 words): text ≈ 60–120K tokens on Gemini
  Flash ≈ **$0.05–0.15**; cover image ≈ **$0.04**; quality checks ≈ $0.02 →
  **~$0.15–0.25** per ebook. Cheap vs. coloring/storybook (no per-page images).
- **Time:** outline ~15s; chapters ~10–25s each (concurrency 3–4) → **~1–3 min**
  → async (Trigger.dev) with live progress.
- **Risks:** AI "sameyness"/repetition across chapters (mitigate: outline-lock +
  voice-lock + dedup/quality gate); KDP quality crackdown (mitigate: the gate +
  editability); EPUB/DOCX format validity (validate with epubcheck-style checks +
  fixtures); long writes (async); over-scope (defer series/A+ to fast-follow).

---

## 10. Roadmap update (supersedes prior "Phase 6+")

- **Phase 6 — Book Opportunity Engine** (refactor + inline recommendations) ⏳ next
- **Phase 7 — Unified Create wizard** ⏳
- **Phase 8 — Async infra (generation_jobs + Trigger.dev)** ⏳
- **Phase 9 — Ebook Creator** (text → editor → quality gate → PDF/EPUB/DOCX → cover) ⏳
- **Phase 10 — Storybook** (resume; reuses async + cover + Opportunity) ⏳
- **Later — Series planner, A+ content, Planners, Billing/Credits, Admin, Agency**

> Open decisions for you: (a) EPUB/DOCX via libraries vs. hand-rolled;
> (b) Cover Generator image model (reuse FLUX Schnell vs. a higher-fidelity model);
> (c) is the **Quality/KDP-readiness gate** a hard block before export or advisory;
> (d) build Opportunity Engine + Unified Create first (recommended) or jump
> straight to the Ebook pipeline.
