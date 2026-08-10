# Cover Generator V2 (Beta) — Architecture Plan

Design memo, not implementation. V1 (`lib/cover/`) stays the default and is not
touched. V2 ships behind a Beta flag next to it.

## What changes

| | V1 (current, stable) | V2 (Beta) |
|---|---|---|
| Artwork | FLUX Schnell, background only | Text-capable model, full composed cover |
| Typography | Our HTML/CSS engine, 6 hardcoded genre profiles | The image model picks the typeface from a written instruction |
| Text accuracy | Always perfect (Chromium renders real fonts) | Model-dependent — must be verified |
| Layout | 3 fixed layout templates | Model composes the layout |
| Editing a title | Instant re-render, no new image | Requires a full regeneration |
| Cost / cover set | ~$0.01 | ~$0.10–$0.35 |

The point of V2 is that the model designs the cover as a whole — type, art and
layout together — instead of us pasting our type over its art. That is how the
best-looking AI covers are made today, and it is also where the real risk sits.

## Risks this design has to solve

These are the reasons V2 must be Beta and must not replace V1.

1. **Typos.** Ideogram 3.0 tests at roughly 90% text accuracy ([nestcontent.com](https://nestcontent.com/blog/text-to-image-ai)).
   That sounds fine until you do the arithmetic: at 90% per image, a 3-concept set
   has only ~73% chance of being *fully* clean. A KDP cover with a misspelled title
   is worthless, and the buyer will blame us, not the model. **Every V2 cover must be
   machine-verified before the user ever sees it.**
2. **Print geometry.** Image models emit aspect ratios, not inches. Ideogram 4.0
   generates at native 2K, up to 2048px per side ([segmind.com](https://www.segmind.com/models/ideogram-4)) —
   at 2:3 that is ~1365×2048, about 227 DPI on a 6×9 cover. KDP wants 300 DPI, so an
   upscale + exact-pixel sizing pass is mandatory, not optional.
3. **Front cover only.** These models produce a single panel. A paperback needs
   back + spine + front as one wrap. V2 produces the **front**; the existing V1 PDF
   engine assembles the wrap around it.
4. **No cheap edits.** Changing an author name in V1 is a re-render. In V2 it is a
   new paid generation. The UI has to say so.
5. **Latency.** 3 images + verification + upscaling will not finish inside a normal
   request. V2 must run as a background job.
6. **Trademark / safety.** A model composing freely may invent logo-like marks or
   near-brand type. Needs a review note in the UI, and the AI disclosure field the
   Publishing Profile already carries.

Content above was rephrased from the cited sources for licensing compliance.

## Which models are actually available (and which to use)

`node --env-file=.env.local --import tsx scripts/list-cf-image-models.ts` lists the
account's catalog. Eleven text-to-image models are reachable. Notably **GPT Image and
Ideogram are not among them** — using either means paying OpenAI or Replicate
directly, outside the Cloudflare credit.

Four candidates were benched on the same kids-book brief
(`scripts/bench-cover-v2-models.ts`), each read back by the vision model:

| Model | Spelling | Size | Time | Est. cost | Contract |
|---|---|---|---|---|---|
| `flux-2-klein-9b` | pass | 1408×2080 | **8s** | $0.019 | multipart |
| `leonardo/phoenix-1.0` | pass | 1392×2048 | 10s | $0.019 | JSON |
| `leonardo/lucid-origin` | pass | 1392×2048 | 13s | $0.019 | JSON |
| `flux-2-dev` | pass | 848×1248 | **235s** | $0.069 | multipart |

Three fast options, all the same price, all inside the credit. dev is 20–30× slower
for no measurable spelling advantage in this round, which removes the main reason to
prefer it.

Two contracts had to be supported as a result: the Black Forest Labs models require
multipart and reject JSON; the Leonardo models take JSON and may reply with a raw
binary body rather than base64. The Leonardo models also cap every side at 2048.
`clampToModel()` holds these per-vendor limits.

**The remaining gap is art direction, not text.** All four spell correctly often
enough for the repair loop to handle; what separates a competitor's cover from ours is
the illustration and the lettering style. That is judged by eye, on the files in
`output/cover-v2-bench/`, not by this pipeline.

## Measured model results (Phase 1, live account)

Run with `node --env-file=.env.local --import tsx scripts/bench-cover-v2-models.ts`.
Every run used the same brief and text contract, and every cover was read back by the
vision model and compared to the requested strings.

| Model | Size | Time | Est. cost | Spelling |
|---|---|---|---|---|
| `flux-2-klein-4b` | — | 2s | — | blocked by the content filter |
| `flux-2-klein-9b` | 1408×2080 | **7s** | $0.019 | passed once, **failed once** |
| `flux-2-dev` | 512×768 | 151s | $0.023 | passed |
| `flux-2-dev` | 832×1248 | 149s | $0.069 | passed |
| `flux-2-dev` | 1024×1536 | 188s | $0.069 | passed |
| `flux-2-dev` | 1408×2080 | **200s** | $0.172 | passed |

The trade-off is sharp and it decides the product shape:

- **dev spells reliably — 4 for 4 — but takes 150–200 seconds per cover.** Latency is
  almost flat across sizes, so generating small to save time does not work; only cost
  falls. Three concepts on dev is a ten-minute job.
- **klein-9b is 25× faster and cheaper, but its text is not dependable.** One run
  produced `QUHET MORNNGS` for *Quiet Mornings* — exactly the failure the verifier
  exists to catch, and proof that shipping klein output unverified would put
  misspelled covers in front of buyers.
- **klein-4b is unusable**: the same prompt that klein-9b rendered fine was rejected
  by the content filter.

Consequences folded into the design:

1. **Default concepts drops from 3 to 2** so a Beta generation stays under about
   seven minutes instead of ten.
2. **V2 must be a background job.** At 200s per image this cannot live in a request,
   which is why it runs on the existing job queue with progress reporting.
3. **Verification stays mandatory even on dev.** Four for four is encouraging, not a
   guarantee, and it costs a fraction of a generation to check.
4. **A `steps` field is not accepted** — sending one makes dev return an opaque 500 —
   so step count cannot be traded against cost or latency.

## Model recommendation

Text rendering is the whole game here, so the shortlist is only models known for it.

| Model | Why it is on the list | Indicative price / image |
|---|---|---|
| **Ideogram 4.0 / 3.0** *(recommended default)* | The typography specialist; native 2K output means less upscaling. Turbo/Default/Quality tiers let us trade cost for accuracy. | Turbo ~$0.03, Default ~$0.06, Quality ~$0.10 ([puter.com](https://developer.puter.com/tutorials/ideogram-api-pricing/)); Replicate lists v3 Quality at $0.09 ([replicate.com](https://replicate.com/ideogram-ai/ideogram-v3-turbo)) |
| **Seedream 4.5** | Reported to match top-tier text quality at lower cost — the value pick for volume | ~$0.03–0.04 ([evolink.ai](https://evolink.ai/blog/seedream-pricing-guide-2026)) |
| **GPT Image 1.5 / 2** | Rated best overall for text rendering; strongest instruction-following | Highest of the group; needs an OpenAI key, not Replicate ([apidog.com](https://apidog.com/blog/best-ideogram-alternative-2026)) |
| **Recraft V4** | Built for design work specifically | ~$0.08 ([recraft.ai](https://www.recraft.ai/pricing?tab=api)) |
| **Flux 2 Pro** | Open-weight, text ability improving | Varies |

**Recommendation: build the provider layer model-agnostic and ship
Ideogram as the default.** Reasons: it is already reachable through the Replicate
token you have, it is the strongest *typography-first* option, and its 2K native
output reduces the upscaling burden. Put the model id in an env var
(`COVER_V2_MODEL`) so switching to Seedream or GPT Image is a config change, and
so you can A/B them on real covers before committing.

Prices above are indicative from third-party pages and change often — re-check
before locking the credit cost.

## Verified contract (probed against the live account)

Cloudflare does not publish the input schema for these models, so the contract below
was established empirically with `npm run probe:cover-v2`. Two of the assumptions
earlier in this document turned out to be wrong; the facts win.

| Thing | Result |
|---|---|
| Endpoint | `POST /accounts/{id}/ai/run/{model}` |
| Request body | **multipart/form-data** — a JSON body is rejected with *required properties at '/' are 'multipart'* |
| Fields | `prompt`, `width`, `height` (exact sizes are honoured) |
| Response | JSON, base64 **JPEG** in `result.image` |
| Output format | **JPEG only** — `output_format` / `response_format` / `format` are all ignored |
| Max size | **1408×2112 works; 1536×2304 returns HTTP 500** |
| Verification model | `@cf/meta/llama-4-scout-17b-16e-instruct`, JSON with OpenAI-style `messages` + `image_url` |
| Models reachable | `flux-2-dev`, `flux-2-klein-9b`, `flux-2-klein-4b` |

Two corrections to the plan above:

1. **The upscale step cannot be dropped.** The generation ceiling of 1408×2112 is
   only ~235 DPI on a 6×9 cover, short of KDP's 300 DPI (1800×2700). Earlier in this
   memo I assumed print-resolution generation would remove that stage — it does not.
2. **Output is JPEG, not PNG.** V1's scorer reads PNG via `pngjs`, and cover objects
   are stored as `.png`, so V2 must convert.

Both are solved by one pass rather than two: load the JPEG as a `data:` URI in an
`<img>` sized to the exact target pixels and screenshot it with the existing
`renderPng`. That single Puppeteer call converts JPEG→PNG *and* produces the exact
KDP pixel dimensions, with no new dependency and no separate upscaler service. The
scale factor is mild (1408→1800 is ~1.28×), so quality loss is minimal.

Also learned, and worth surfacing in the UI: **the safety filter rejects prompts that
echo well-known titles.** A probe prompt containing a famous book title came back
`code 3030 — your output has been flagged`, while an original title generated
cleanly. Buyers typing a title close to a famous work will hit this, so the error
needs a human explanation rather than a raw failure.

Verification quality is confirmed, not assumed: the vision model read back
`QUIET MORNINGS` from a generated cover exactly.

## Pipeline

Runs as a background job (`job_type = 'cover_v2'`) on the existing queue, so it
inherits the atomic reserve/refund, attempt leases and retry work from migration
0019 rather than reinventing them.

```
1. Validate + gate        entitlement cover_v2, Beta flag on, 1 job per user at a time
2. Art direction          OpenRouter → design brief JSON (typography in words, not fonts)
3. Compose prompt         brief + exact text strings, quoted, with a hard text contract
4. Generate               N concepts via the configured model (sequential)
5. Verify text            vision model reads the image back; compare to the input strings
6. Repair                 up to 2 retries per concept; then hybrid fallback
7. Upscale                to ≥300 DPI for the chosen trim
8. Size exactly           deterministic crop/pad to trim + bleed via lib/pdf/kdp-specs
9. Score                  reuse the existing V1 scorer
10. Store + deliver       canonical keys, signed URLs, job completes
```

### Step 2 — art direction produces a brief, not a font

The AI art director returns JSON. Note that typography is described in **words** —
the image model chooses the actual typeface, which is the behaviour you asked for.

```json
{
  "concept": "A lone lantern on a fogged jungle path at dawn",
  "composition": "title occupies the top third, art fills the lower two thirds",
  "palette": ["deep teal", "warm amber", "cream"],
  "typographyInstruction": "heavy geometric sans-serif, all caps, tight letter spacing, cream on dark",
  "titleTreatment": "largest element, three lines, centred",
  "authorTreatment": "small, bottom centre, letter-spaced",
  "mood": "adventurous, warm, slightly mysterious"
}
```

### Step 3 — the text contract

Models render quoted strings far more reliably than described ones, so the prompt
states the text literally and forbids anything else:

```
Render EXACTLY this text and no other words:
Title: "JUNGLE BOOK ADVENTURES"
Author: "PREM SHARMA"
Typography: heavy geometric sans-serif, all caps, tight tracking, cream on dark.
Do not add taglines, series names, publisher marks, badges, or invented words.
Spell every word exactly as given.
```

### Step 5 — verification is the load-bearing part

This is what makes V2 sellable rather than a novelty.

- Send the generated image to a multimodal model through the existing OpenRouter
  client and ask it to transcribe only the text it can see.
- Normalise both sides (case, punctuation, whitespace) and compare.
- Accept on exact match of title and author. Reject on any missing word, extra
  word, or misspelling.
- Reject also when the model reports unreadable or overlapping text.

Verification costs a fraction of an image generation, and it converts a 90%-accurate
model into a pipeline that either ships a correct cover or knowingly falls back.

### Step 6 — the fallback that guarantees a usable cover

| Attempt | Action | Verified live |
|---|---|---|
| 1 | Full text, as briefed | ✅ caught `QURIET MORIWINGS` for *Quiet Mornings* |
| 2 | Subtitle dropped, legibility emphasised | ✅ passed on the retry, 29s total |
| 3 | Title only | — |
| Fallback | **Wordless artwork** + V1 typography engine | ✅ 10s, correct type by construction |

There is no seed parameter on these endpoints, so a retry is naturally a fresh
sample — which is exactly what a text failure needs.

The fallback is also exposed as a deliberate mode (`--hybrid`, `maxAttempts: 0`):
AI artwork with guaranteed-correct type is a legitimate thing for a buyer to want,
not merely a consolation prize.

The fallback is the strongest idea in this plan: V1 already produces perfect text
over supplied art, so a V2 concept can always degrade into a V1-quality cover
instead of failing. The concept records which path it took
(`text_source: "model" | "hybrid"`), and the UI shows it.

### Steps 7–8 — print correctness

One deterministic Puppeteer pass, no AI and no new dependency:

- Generate at the ceiling (1408×2112), then render that JPEG as a `data:` URI inside
  an `<img>` sized to the exact target pixels and screenshot it as PNG via the
  existing `renderPng`.
- Target pixels come from `lib/pdf/kdp-specs.ts` — 6×9 at 300 DPI is 1800×2700, and
  1875×2775 with bleed.
- Assert the final pixel dimensions and effective DPI before storing. A concept that
  fails the assertion is treated as failed, not shipped.

This replaces the separate upscaler service in the original plan and reuses code that
is already covered by the existing PDF gate.

## Data model

Forward-only migration **`0022_cover_v2.sql`**:

- `covers.engine text not null default 'v1'` — `'v1' | 'v2'`
- `covers.design_brief jsonb` — the art-direction JSON, for reproducibility
- `covers.model text` already exists; V2 stores the image model id
- Per-concept fields inside the existing `concepts` jsonb:
  `text_source`, `text_verified`, `verify_attempts`, `upscaled`, `final_px`
- No change to `variation_keys`; V2 uses the same canonical key scheme, so the
  existing download, PDF, and use-for-book routes work unchanged.

Reusing the `covers` table (rather than a new one) means the Cover Studio library,
downloads and "use for book" need no new plumbing.

## Files

```
lib/cover-v2/
├─ types.ts          # V2 concept, brief, verification result
├─ brief.ts          # OpenRouter art director → design brief JSON
├─ prompt.ts         # brief + text contract → final image prompt
├─ providers/
│  ├─ index.ts       # picks provider from COVER_V2_MODEL
│  ├─ ideogram.ts    # default
│  └─ seedream.ts    # alternate
├─ verify.ts         # vision transcription + comparison
├─ upscale.ts        # upscale + exact KDP pixel sizing + assertions
└─ generate.ts       # orchestrates the pipeline, returns concepts

app/api/cover-v2/route.ts            # POST → enqueues a job
app/dashboard/cover-v2/page.tsx      # Beta UI
components/dashboard/cover-v2-*.tsx  # form + results with Beta badge
supabase/migrations/0022_cover_v2.sql
scripts/test-cover-v2.ts             # offline checks (no paid calls)
```

Reused unchanged: `lib/jobs/*`, `lib/billing/*`, `lib/storage/*`,
`lib/cover/score.ts`, `lib/pdf/kdp-specs.ts`, and V1's HTML typography engine for
the hybrid fallback.

## Credits

V1 charges 1 credit for a 3-concept set costing us about $0.01. V2 cannot be
priced the same way.

| Item | Real cost (est.) | Suggested credits |
|---|---|---|
| V2 set, 3 concepts, Ideogram Default | ~$0.18 + verify + upscale ≈ $0.25 | **12** |
| V2 set on Turbo tier | ~$0.09 + overhead ≈ $0.14 | **8** |
| Single concept regenerate | ~$0.08 | **4** |

At the funnel's ~$0.018/credit assumption, 12 credits ≈ $0.22 of value against
~$0.25 of cost, so **either price V2 at 14–16 credits or default to the Turbo
tier**. Retries and fallbacks are *not* charged again — they are our cost of
guaranteeing correct text, and the atomic job refund already covers total failure.

## Beta gating

- **Entitlement** `cover_v2`, granted per offer — so V2 can be sold as its own OTO.
- **Env flag** `COVER_V2_ENABLED=1`, plus `COVER_V2_MODEL`. Off means the route
  returns 403 and the nav entry is hidden.
- **UI**: a Beta badge on the nav item and the page, and one honest line of copy —
  the model composes the type, results vary more than the stable engine, and text
  is machine-checked before delivery.
- **Per-concept transparency**: show `text_source` so the user knows whether the
  model set the type or the hybrid fallback did.
- V1 stays the default Cover Studio. Nothing about it changes.

## Validation plan

Offline (`npm run test:cover-v2`, no paid API calls):
- text-contract builder includes every input string and the prohibitions
- verification comparator: catches missing words, extra words, single-character
  typos, case/punctuation differences; passes on exact match
- KDP sizing math: output pixels and DPI exactly match `kdp-specs` for each trim
- hybrid fallback produces a cover with correct text when the model path fails

Paid smoke test, run manually once with a real token:
- one set per genre, checked by eye and by the verifier
- confirm ≥300 DPI and exact dimensions on the stored PNG
- confirm the PDF download and use-for-book paths work on a V2 cover

## Build order

| Phase | Work | Size |
|---|---|---|
| 0 | ✅ **Done** — migration 0022, `cover_v2` entitlement, env flags, gated Beta page + nav, verified Cloudflare contract (`npm run probe:cover-v2`) | S |
| 1 | ✅ **Done** — provider client, art director, text contract, exact-KDP finalize, verification, one concept end to end (`npm run test:cover-v2`, `npm run smoke:cover-v2`), model bench | M |
| 2 | ✅ **Done** — repair loop (3 escalating strategies) + hybrid fallback verified live; `--hybrid` mode exposed | M |
| 3 | ✅ **Done** — folded into Phase 1: one Puppeteer pass converts JPEG→PNG and sizes to exact KDP pixels | M |
| 4 | Job-runner branch, 3-concept set, scoring, storage, signed URLs | M |
| 5 | Beta UI: form, results, per-concept transparency, regenerate | M |
| 6 | Offline test suite; then one paid smoke test per genre | S |

Phase 2 is the one that decides whether V2 is a product or a demo. Do not skip it.

## Open questions for you

1. **Model**: default to Ideogram (Replicate token already works) or add an OpenAI
   key for GPT Image? I would start on Ideogram and A/B Seedream on cost.
2. **Quality tier**: Turbo (cheap, more retries) or Default/Quality (dearer, fewer
   retries)? Retry cost may make the dearer tier cheaper overall — worth measuring
   in Phase 1.
3. **Concept count**: 3 like V1, or 2 to halve the cost while Beta?
4. **Trims**: front cover only at 6×9 for Beta, or all three trims immediately?
5. **Sell it how**: bundled into an existing tier, or its own OTO given the cost?
