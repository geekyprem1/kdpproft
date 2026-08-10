# Children's Story Book Generator — Technical Design

> **Status: design only. No implementation yet.** This document defines the
> architecture, data flow, schema, APIs, and (most importantly) the
> **character-consistency strategy** before any code is written.

Input: a one-line idea (e.g. *"A dragon learns kindness"*).
Output: outline → character bible → page-by-page story → **consistent
illustrations** → cover → metadata → KDP-ready PDF.

This is the **first multi-step, image-heavy, multi-minute** book type, so unlike
the puzzle/coloring generators it **must run asynchronously** (background job),
not inside a request.

---

## 1. System Architecture

Reuses the existing stack; adds an async job runner and a reference-conditioned
image model.

```
Browser (Next.js dashboard)
   │  POST /api/story (idea + config)
   ▼
Next.js API ──insert──> Supabase (books, story_*, generation_jobs)
   │  enqueue
   ▼
Trigger.dev task: generate-story   ◄── NEW (durable, multi-step, retryable)
   ├─ 1. Story Planner        → OpenRouter (Gemini → DeepSeek)   [text]
   ├─ 2. Character Bible       → OpenRouter (structured JSON)     [text]
   ├─ 3. Reference Sheets      → Image model (per character)      [image]
   ├─ 4. Page Script           → OpenRouter (text + scene prompt) [text]
   ├─ 5. Page Illustrations     → reference-conditioned image gen  [image] ×N
   ├─ 6. (opt) Consistency Gate → Gemini multimodal judge          [vision]
   ├─ 7. Cover                  → image gen + title typesetting     [image]
   ├─ 8. Metadata              → OpenRouter                        [text]
   └─ 9. Assembly             → Puppeteer → interior + cover PDF   [pdf]
        └─ store to Supabase Storage / R2; mark job complete
Client polls GET /api/story/[id] (or Supabase Realtime) for live progress.
```

**Reused unchanged:** Supabase Auth + `proxy.ts` gating, dashboard layout, the
`lib/storage` provider abstraction, the KDP PDF engine (`lib/pdf`, incl.
`fullBleed`), the OpenRouter provider abstraction (`lib/ai`), and the
`books`/`book_metadata`/`downloads` tables.

**New:** `lib/generators/story/`, a Trigger.dev task, `generation_jobs` +
`story_characters` + `story_pages` tables, and a reference-conditioned image
provider (see §6/§12).

---

## 2. Data Flow Diagram

```
idea + config
  └─► [Planner] ─► story spec {title, theme, moral, age, tone, setting}
        └─► [Outline] ─► beats[] (arc) mapped to page count
              └─► [Character Bible] ─► characters[] {structured appearance + descriptor}
                    └─► [Reference Sheet] ─► master image per character  ●anchor
                          └─► [Page Script] ─► pages[] {text, scenePrompt}
                                └─► for each page:
                                      scenePrompt + characterDescriptor + style
                                        + REFERENCE IMAGE ──► [Illustrator] ─► page image
                                          └─► [Consistency Gate?] ─► pass / retry
                                └─► [Cover] ─► cover image + title
                                └─► [Metadata] ─► title/subtitle/description/keywords
                                      └─► [Assembly] ─► interior.pdf + cover.pdf
                                            └─► Storage ─► signed download URLs
```

Job states: `queued → planning → bible → references → pages (k/N) → cover →
assembling → completed | failed`. Each page is an independently-tracked unit.

---

## 3. Database Schema Changes

Reuse `books` (with `book_type = 'story'`); add three tables. (Proposed migration
`0005_story.sql` — **not applied yet**.)

```
-- finally introduced: durable job tracking (was deferred)
generation_jobs
  id, book_id→books, user_id→profiles, status, current_step,
  progress (0-100), trigger_run_id, attempts, error,
  started_at, finished_at, created_at

story_characters            -- the Character Bible (one row per character)
  id, book_id→books, name, role,            -- protagonist | supporting | ...
  appearance jsonb,                         -- structured spec (species, colors, features…)
  descriptor text,                          -- compiled, fixed-wording prompt fragment
  reference_key text,                       -- storage key of the locked reference image
  seed integer,                             -- locked image seed
  created_at

story_pages
  id, book_id→books, page_number, kind,     -- title | story | end
  text text,                                -- page narration
  scene_prompt text,                        -- LLM-authored scene description
  image_key text,                           -- storage key of the page illustration
  status text,                              -- pending | rendered | failed
  attempts integer, error text,
  unique(book_id, page_number)
```

`books.config` (jsonb) holds story-level config: `idea, ageRange, artStyle,
pageCount, trim, palette`. RLS: owner-only `select/insert/update/delete` on all
three; writes during generation go through the **service role** (job runner).
Per-page + per-character rows make generation **resumable and retryable** (§9).

---

## 4. API Design

```
POST /api/story
  body: { idea, ageRange, pageCount, artStyle?, trim? }
  → create books row (status 'generating') + generation_jobs row
  → trigger generate-story task
  → 202 { bookId, jobId }

GET  /api/story/[id]            → { status, currentStep, progress, pages:[{n,status}] }
                                  (or subscribe via Supabase Realtime on generation_jobs)
POST /api/story/[id]/retry       → re-run failed pages/steps
POST /api/story/[id]/regenerate-page  { pageNumber }  → re-illustrate one page
GET  /api/books/[id]/download?part=interior|cover     → reuse existing route
```

`maxDuration` no longer relevant for generation (it runs in Trigger.dev, not the
request). The route only enqueues. Dashboard: a **Story** book type with a
progress view (per-page thumbnails as they complete).

---

## 5. Story Planning Workflow

All steps are structured-JSON OpenRouter calls (Gemini 2.5 Flash primary →
DeepSeek fallback) through the existing `generateJson` provider with Zod-style
validators.

1. **Premise expansion** → `{title, logline, theme, moral, setting, targetAge,
   tone, palette}`. Low temperature.
2. **Outline** → ordered story beats following a simple arc (setup → inciting
   incident → rising → climax → resolution → moral), count-matched to the page
   budget (e.g. 24 story pages).
3. **Character Bible** (§6) → `characters[]` with strict appearance schema.
4. **Page script** → for each page: `{ text (1–3 short, age-graded sentences),
   scenePrompt (who / where / action / emotion / camera) }`. Higher temperature
   for prose, but characters referenced by canonical name only.
5. **Validation** → reading-level check, max words/page, safety/banned-content
   filter, ensure every referenced character exists in the bible.

---

## 6. Character Consistency Strategy ★ (the hard problem)

> **Goal: the same dragon looks like the same dragon across all 24+ pages.**
> Text-to-image models drift badly if you only describe the character in words —
> page 7's dragon won't match page 18's. Consistency is engineered in **five
> layers**, with a single **locked reference image** as the visual anchor.

### Layer 1 — Canonical Character Bible (textual identity lock)
The LLM emits a **structured** appearance spec per character, not prose:
```
{ species:"dragon", build:"small, round, friendly",
  primaryColor:"emerald green (#2e8b57)", bellyColor:"cream",
  features:["three small blue dorsal spines","oversized amber eyes","stubby wings"],
  accessory:"red knitted scarf", ageFeel:"young/child", noTeeth:true }
```
From it we compile ONE **fixed-wording descriptor string**, e.g.
*"a small round friendly emerald-green dragon with a cream belly, three small
blue dorsal spines, oversized amber eyes, stubby wings, wearing a red knitted
scarf"*. This exact string is injected **verbatim into every prompt** — identical
wording every time removes a major source of drift.

### Layer 2 — Character Reference Sheet (visual anchor) ●
Before any page is drawn, generate **one master reference image per character**
(neutral full-body, plain background) using the descriptor + locked style + a
**locked seed**. Validate it (auto/human). This image is the **ground truth** for
that character's appearance and is stored (`story_characters.reference_key`).

### Layer 3 — Reference-conditioned per-page generation (the key mechanism)
Every page illustration is generated **conditioned on the reference image(s)**,
not from text alone. This is what actually carries identity across scenes.
Model options (on Replicate / via API):
| Approach | How it preserves identity | Notes |
|---|---|---|
| **FLUX.1 Kontext** | takes an input image + edit/scene instruction, keeps the subject | purpose-built for "same character, new scene" — **recommended** |
| **Gemini 2.5 Flash Image** ("nano-banana") | multi-image reference + instruction; strong character consistency | recommended alt; great for multi-character |
| IP-Adapter (FLUX/SDXL) | image-prompt embedding conditions the gen | flexible, more tuning |
| FLUX Schnell (text only) | ❌ no reference → drifts | **insufficient** for storybooks; keep only as cheap style baseline |

**Decision: use a reference-conditioned model (FLUX Kontext or Gemini 2.5 Flash
Image) for story pages.** FLUX Schnell (used for coloring books) is *not* enough
here. For multi-character pages, pass multiple reference images (Kontext/Gemini
support multi-image conditioning).

### Layer 4 — Style & technical lock
A single fixed **art-style descriptor** (e.g. "soft watercolor children's book
illustration, flat warm palette, gentle outlines"), fixed palette, fixed aspect
ratio, and a stable seed family across the whole book. Style drift is as jarring
as character drift, so it's locked the same way.

### Layer 5 — Consistency gate (drift detection + retry)
After each page, optionally call a **vision LLM** (Gemini multimodal) to compare
the page image to the reference: *"Same character? Do colors/features/accessory
match? Score 0–1."* Below threshold → regenerate (stronger conditioning / new
seed), up to a cap. Configurable (adds cost/time, §8/§14).

**Why this works:** identity is pinned by (a) identical textual descriptor every
time, (b) a single locked reference image fed as image-conditioning into all
pages, (c) locked style/palette/seed, and (d) a vision gate that rejects and
retries drift. The reference image is the anchor — remove it (text-only) and the
character will not survive 24 scenes.

---

## 7. Illustration Generation Strategy

1. Generate reference sheet(s) → validate → lock.
2. For each page: compose prompt = `style + scenePrompt + character descriptor(s)
   + composition hints (+ text-safe negative space if text overlays the art)`;
   generate **conditioned on the character reference image(s)**.
3. Validate (quality + consistency gate) → retry on failure.
4. Store the page image; update `story_pages`.
- **Concurrency:** 3–4 pages in parallel (bounded pool), respecting provider rate
  limits.
- **Composition:** reserve a text zone (e.g. bottom third) or generate full-bleed
  and overlay text in a translucent band (§10).
- **Aspect ratio:** matches the trim (square 8×8 or portrait 8.5×11).

---

## 8. Cost Analysis Per Book (24 story pages)

Indicative; verify against live provider pricing.

| Item | Count | Unit | Subtotal |
|---|---|---|---|
| Text (planner, outline, bible, page script, metadata) | ~5 calls | ~$0.005–0.02 | **~$0.05** |
| Reference sheets | 1–3 | reference-model rate | ~$0.05–0.12 |
| Page illustrations (FLUX Kontext / Gemini image ~$0.03–0.04) | 24 | ~$0.035 | **~$0.84** |
| Cover image | 1 | ~$0.035 | ~$0.04 |
| Consistency gate (vision, optional) | 24 | ~$0.003 | ~$0.07 |
| **Total (reference-conditioned)** | | | **~$1.05–1.30** |
| Retry buffer (×1.3) | | | **~$1.4–1.7** |
| _Alt: FLUX Schnell text-only (low consistency)_ | | ~$0.003 | _~$0.15 (not recommended)_ |

Takeaway: a quality, character-consistent 24-page book costs **~$1–1.7** in API.
Set a per-book image cap to bound retry cost.

---

## 9. Retry & Error Recovery Design

- **Durable job + per-unit state.** Each page/character is a row with `status` +
  `attempts`; the orchestrator skips already-`rendered` units on resume
  (idempotent via deterministic storage keys).
- **Trigger.dev** provides checkpointed steps, automatic retries, and backoff;
  a crash/restart resumes from the last completed step.
- **Provider failures** (429/5xx/timeouts): exponential backoff, capped attempts.
- **Partial failure policy:** a page that exhausts retries is marked `failed`;
  the job continues other pages. Final assembly either blocks on any failure or
  proceeds with a placeholder + surfaces "regenerate page N" — configurable.
- **Cost guard:** hard cap on total image calls per job.
- **UX:** progress view shows per-page status; targeted retry/regenerate endpoints
  (§4) avoid re-running the whole book.

---

## 10. PDF Layout Design

- **Trim:** 8×8 square (classic picture book) or 8.5×11; **bleed ON** (full-page
  art). Reuses the PDF engine's `fullBleed` page support and KDP spec math.
- **Page types:** title → (copyright) → (dedication) → story pages → "The End".
- **Story-page layouts (pick per book):**
  1. **Full-bleed art + text band** — art fills the page; narration sits in a
     translucent rounded panel in a safe zone.
  2. **Image / text split** — art top ~70%, text bottom ~30%.
  3. **Facing spread** — verso text, recto image (needs even pacing).
- **Typography:** large (≈18–28pt), high-contrast, kid-friendly rounded font,
  inside the safe margins; never over busy art without a backing panel.
- Same mirrored-margin + folio rules as other books (folios optional for picture
  books). Cover reuses the existing cover builder (no new cover generator).

---

## 11. OpenRouter Prompt Strategy

- Reuse `lib/ai` provider (Gemini 2.5 Flash → DeepSeek), `generateJson` with
  validators + automatic fallback on schema failure.
- **Separate, single-responsibility prompts:** premise, outline, character bible
  (strict appearance JSON), page script, metadata, and (optional) the vision
  consistency judge.
- **Temperatures:** low (≈0.3) for structured/spec steps; higher (≈0.8) for
  narrative prose.
- **Determinism aids:** fixed system prompts; characters referenced by canonical
  name; bible compiled into the fixed descriptor that all image prompts reuse.
- Age-grading + safety instructions embedded in the system prompt.

---

## 12. FLUX / Image Prompt Strategy

- **Reference-sheet prompt:** `"<style>, character reference, full body, neutral
  pose, plain background, <descriptor>, consistent design"` + locked seed.
- **Page prompt:** `"<style>, <scenePrompt: setting/action/emotion>, featuring
  <descriptor>, <composition>, same character design as reference"` **+ reference
  image(s) as conditioning input**.
- **Avoid:** text, letters, watermark, signature, extra limbs, duplicated
  characters, off-model colors (baked into prompt / model negative where
  supported).
- **Locks:** style tokens, palette, aspect ratio, and seed family fixed for the
  whole book. Multi-character pages enumerate each descriptor + its reference.
- FLUX Schnell remains only a fallback/style baseline; story pages use the
  reference-conditioned model (§6).

---

## 13. Storage Strategy

Reuse the `lib/storage` abstraction (Supabase Storage now, R2 later — one-line
switch). Keep **all intermediate artifacts** to enable resume, per-page
regenerate, and future edits:
```
stories/{userId}/{bookId}/characters/{characterId}.png   (reference sheets)
stories/{userId}/{bookId}/pages/{n}.png                  (page illustrations)
stories/{userId}/{bookId}/cover.png
stories/{userId}/{bookId}/interior.pdf
stories/{userId}/{bookId}/cover.pdf
```
Private bucket + short-lived signed URLs for download. Lifecycle cleanup for
abandoned drafts (no completed PDF after N days). Page images embedded into the
interior PDF as data URIs at assembly time (as the coloring generator does).

---

## 14. Estimated Generation Time (24 pages)

| Step | Time |
|---|---|
| Planning + outline + bible + page script + metadata (text) | ~15–30s |
| Reference sheet(s) (1–3 images) | ~10–40s |
| Page illustrations (24 @ concurrency 4, ~8–15s each, reference-conditioned) | ~60–110s |
| Consistency gate (optional, 24 vision calls) | ~20–45s |
| Cover + assembly (Puppeteer, image-heavy ~26 pages) | ~15–35s |
| **Total** | **~2–5 minutes** |

This multi-minute total is exactly why generation **must be asynchronous**
(Trigger.dev) with a live progress UI — a synchronous request would time out.

---

## 15. Engineering Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Character drift across pages** | 🔴 highest | reference-conditioned model + locked descriptor/seed/style + vision gate (§6); residual risk on cheaper models |
| Image DPI vs KDP 300dpi (full-page) | 🟠 | reference models output ~1–2MP; add an upscale step for print, or use square trim where DPI is sufficient |
| Long-running jobs / serverless limits | 🟠 | Trigger.dev (durable, off the request path); Puppeteer memory for image-heavy PDFs → render in a worker, browser pool |
| Cost blow-ups from retries | 🟠 | per-book image cap + backoff + partial-failure policy (§9) |
| Provider availability / rate limits / pricing changes | 🟠 | provider abstraction, backoff, fallback model; cost guard |
| Text legibility over illustrations | 🟡 | text-safe zones / translucent panels (§10); generate negative space |
| Multi-character scene consistency | 🟡 | multi-image reference (Kontext/Gemini); limit characters per page |
| Content safety for children | 🟡 | safety system prompts + moderation pass; banned-content validator |
| Limited reproducibility (image models) | 🟡 | seed locking helps but isn't exact under reference conditioning; store artifacts so output is stable once generated |

---

## Implementation Roadmap (when approved)

1. **Foundations** — `0005_story.sql` (`generation_jobs`, `story_characters`,
   `story_pages`); wire Trigger.dev; reference-conditioned image provider
   (`lib/ai/image-ref.ts`) behind an interface (FLUX Kontext or Gemini image).
2. **Text pipeline** — planner → outline → character bible → page script →
   metadata (OpenRouter, structured + validated). Testable offline with fixtures.
3. **Character engine** — reference-sheet generation + storage + the consistency
   gate. *Prove consistency on a single character across 6 scenes before scaling.*
4. **Page illustration** — per-page reference-conditioned generation, concurrency,
   retry, per-page state.
5. **Assembly** — story PDF layouts (full-bleed + text band), title/end pages,
   cover; reuse PDF engine.
6. **API + UI** — `/api/story`, progress view with live per-page thumbnails,
   regenerate-page, download.
7. **Validation suite** — bible schema, page-count/parity, consistency-gate
   thresholds on a fixture set, PDF generation; one real end-to-end sample.
8. **Hardening** — cost caps, cleanup, moderation, upscaling for DPI.

**Recommended first proof-of-concept:** lock one character (the dragon), generate
a reference sheet, then render 6 varied scenes with the reference-conditioned
model + vision gate. If the dragon stays on-model across all 6, the approach
scales to 24+. This de-risks the whole feature before building the pipeline.

> Open decisions for you: (a) image model — **FLUX Kontext vs Gemini 2.5 Flash
> Image** (both reference-capable; pick on quality/cost after the POC);
> (b) trim — **8×8 square vs 8.5×11**; (c) consistency gate **on by default** or
> opt-in (cost/time vs safety).
