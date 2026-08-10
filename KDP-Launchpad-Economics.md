# KDP Launchpad — Credits, Costs & Profit

> Commission model (tera): **LaunchpadJV 10%** + **Affiliate 55%** → vendor (tu) = **35%** of sale.
> (Payment processing/refunds alag; woh net 35% me se thoda aur kat sakta hai.)

---

## PART 1 — Engine cost (credits per generation)

Source: `lib/billing/cost.ts`. Credits internal unit hain.

| Engine | Credits | Real AI cost | Note |
|--------|---------|--------------|------|
| Word Search | 1 + (puzzles/25) → ~2 | ~$0 | offline |
| Sudoku | 1 + (puzzles/25) → ~3 | ~$0 | offline |
| Maze | 1 + (mazes/25) → ~2 | ~$0 | offline |
| Word Scramble | 1 | ~$0 | offline |
| Cryptogram | 1 | ~$0 | offline |
| Connect-the-Dots | 1 | ~$0 | offline |
| Tracing | 1 | ~$0 | offline |
| Math | 1 | ~$0 | offline |
| Journals & Planners (lowcontent) | 1 | ~$0 | offline |
| Crossword | 2 | ~$0.005 | AI clues (text) |
| Activity Book | 2 | ~$0.005 | mixes engines |
| Market Intelligence | 1 | ~$0.005 | AI text |
| Title Optimizer | 1 | ~$0.005 | AI text |
| Publish Package | 1 | ~$0.005 | AI text |
| Cover Studio V1 | 1 | ~$0.005 | template/AI |
| Coloring Book (24 img) | 2 + (img/5) → ~7 | ~$0 (CF credit) / else ~$0.24 | AI images |
| Ebook (10 ch) | 2 + chapters → ~12 | ~$0.02–0.05 | AI text |
| Story Book (22 pg) | 4 + (pg/3) → ~12 | ~$0.20–0.30 | AI illustrations |
| Cover Studio V2 | 4 | ~$0.02–0.04 | GPT Image 2 (~$0.01/img × ~2 concepts) |

**Key insight:** ~12 engines ka real cost **~$0** hai (offline/algorithmic). Sirf **image engines**
(coloring, story book, cover v2) aur bulk ebook me real paisa lagta hai — wo bhi cents me.

---

## PART 2 — Credits per OTO (current in `offers.ts`)

| Offer | Credits | Downsell credits | ~Kitne books banenge |
|-------|---------|------------------|----------------------|
| FE Commercial | 120 | — | ~40–120 simple books / ~10 ebooks |
| OTO1 Creator Suite | 600 | 400 | ~50 coloring / ~50 ebooks |
| OTO2 Unlimited | 2,000* | 1,000* | *credit-free — buffer only |
| OTO3 DFY | 0 | 0 | library download (no gen) |
| OTO4 Autopilot | 1,500 | 900 | ~40 autopilot runs (120 books) |
| OTO5 Bundle & Series | 800 | 500 | ~15–25 bundles |
| OTO6 Agency | 1,200 | 800 | mixed premium output |
| OTO7 Reseller | 2,500 | 1,500 | mixed premium output |

*Unlimited buyers spend nothing — credits sirf display buffer hain.

---

## PART 3 — Unlimited ka credit-free logic (already built)

Code me implement ho chuka hai:
1. `isUnlimited(entitlements)` → `entitlements.unlimited === true`
2. `canUseFeature()` → unlimited hai to har feature true (sab unlock)
3. `reserve()` (credit ledger) → unlimited hai to spend **skip** (generation free)
4. Autopilot ka manual balance-check bhi unlimited pe skip

**Risk:** credit-free hone se ek heavy user bahut saari **image books** (story/coloring/cover v2)
bana sakta hai — real image cost lag sakta hai. Example: 100 story books × ~$0.25 = ~$25,
jo Unlimited ke net ($23.45) se zyada ho sakta hai.
**Mitigation (already/optional):** rate-limits pehle se hain (`lib/util/rate-limit`). Chahe to
Unlimited pe bhi ek fair-use daily cap laga sakte hain (sirf image engines pe).

---

## PART 4 — Profit per sale (10% platform + 55% affiliate = 35% net)

Net = price × 0.35. Fulfillment (AI) cost cents me, isliye profit ≈ net.

| Offer | Price | Platform 10% | Affiliate 55% | **Net (35%)** | Est. AI cost | **~Profit** |
|-------|-------|--------------|---------------|---------------|--------------|-------------|
| FE | $17 | $1.70 | $9.35 | **$5.95** | ~$0.05 | **~$5.90** |
| OTO1 Creator | $37 | $3.70 | $20.35 | **$12.95** | ~$0.50 | **~$12.45** |
| OTO2 Unlimited | $67 | $6.70 | $36.85 | **$23.45** | varies* | **~$20–23** |
| OTO3 DFY | $67 | $6.70 | $36.85 | **$23.45** | ~$0 | **~$23.45** |
| OTO4 Autopilot | $97 | $9.70 | $53.35 | **$33.95** | ~$1–2 | **~$32** |
| OTO5 Bundle | $47 | $4.70 | $25.85 | **$16.45** | ~$0.20 | **~$16.25** |
| OTO6 Agency | $97 | $9.70 | $53.35 | **$33.95** | ~$0.50 | **~$33.45** |
| OTO7 Reseller | $197 | $19.70 | $108.35 | **$68.95** | ~$1 | **~$68** |

*Unlimited: cost user-behaviour pe depend karta hai (image engines).

### Downsell profit (35% net)
| Downsell | Price | Net (35%) |
|----------|-------|-----------|
| Creator Lite | $27 | $9.45 |
| Unlimited Lite | $47 | $16.45 |
| DFY Starter | $47 | $16.45 |
| Autopilot Lite | $67 | $23.45 |
| Bundle Starter | $37 | $12.95 |
| Agency Lite | $67 | $23.45 |
| Reseller Starter | $97 | $33.95 |

---

## PART 5 — Full funnel value (agar 1 buyer sab le)

- **List total (all mains):** $17+37+67+67+97+47+97+197 = **$626**
- **Vendor net (35%):** **~$219 per buyer**
- Affiliate ko (55%): ~$344 → yahi affiliates ko promote karne ka incentive
- Platform (10%): ~$63

**Realistic:** har buyer sab nahi leta. Typical funnel me FE + 1–2 OTO bikte hain.
Average order value badhane ke liye Creator Suite ($37) + Unlimited ($67) sabse strong middle hain.

---

## PART 6 — Observations / decisions

1. **Affiliate 55% high hai** (aggressive) — yeh JV partners ko attract karne ke liye achha hai,
   par tera net 35% pe aa jaata hai. Front-end pe 55% common hai; chahe to back-end (high-ticket
   Reseller/Agency) pe affiliate % kam kar sakte hain taaki net badhe.
2. **Image engines** hi real cost hain — Unlimited pe fair-use cap soch lena.
3. **DFY = pure profit** (koi gen cost nahi) — isko push karna faydemand.
4. Credits amounts theek lagte hain; tune karna ho to bata.

---

## PART 7 — Image credit system + WORST-CASE profit

### Image ke liye credit system — same pool
- **Ek hi credit pool hai** (`subscriptions.credits_remaining`). Text, puzzle, aur image —
  sab isi ek pool se katte hain. Alag "image credit" nahi.
- Image engines bas **zyada credits** lete hain (neeche).
- **Unlimited** = koi deduction nahi (reserve skip).

### Generate karne pe kitne credits (real provider cost)
| Engine | Credits/book | Provider | Real $/book | ~$/credit |
|--------|--------------|----------|-------------|-----------|
| Puzzle/Workbook/Journal | 1–3 | offline | $0 | $0 |
| Text (niche/title/publish/crossword/activity) | 1–2 | OpenRouter | ~$0.005 | ~$0.003 |
| Ebook (10 ch) | ~12 | OpenRouter | ~$0.03 | ~$0.003 |
| Cover V1 | 1 | Replicate | ~$0.005 | ~$0.005 |
| **Coloring (24 img)** | ~7 | Replicate FLUX Schnell | ~$0.07 | **~$0.010** |
| **Story Book (22 pg)** | ~12 | SiliconFlow FLUX Kontext | ~$0.30 | **~$0.025** |
| **Cover V2 (2 concepts)** | 4 | GPT Image 2 (Replicate) | ~$0.03 | ~$0.0075 |

### Worst-case: agar buyer SAARE credits use kar de (sabse mehenge unlocked engine pe)
| OTO | Credits | Sabse mehenga unlocked engine | Worst cost | Net (35%) | **Worst profit** |
|-----|---------|-------------------------------|-----------|-----------|------------------|
| FE | 120 | sirf offline | ~$0 | $5.95 | **$5.95** ✅ |
| Creator Suite | 600 | Coloring (~$0.010/cr) | ~$6.00 | $12.95 | **$6.95** ✅ |
| Unlimited | free | fair-use risk (metered nahi) | varies | $23.45 | see note ⚠️ |
| DFY | 0 | — (no gen) | $0 | $23.45 | **$23.45** ✅ |
| Autopilot | 1,500 | Ebook (text ~$0.003/cr) | ~$4.50 | $33.95 | **$29.45** ✅ |
| Bundle | 800 | Puzzle/Workbook (offline) | ~$0 | $16.45 | **$16.45** ✅ |
| Agency | 1,200 | Coloring (~$0.010/cr) | ~$12.00 | $33.95 | **$21.95** ✅ |
| Reseller | 2,500 | Coloring (~$0.010/cr) | ~$25.00 | $68.95 | **$43.95** ✅ |

**Nikla kya:**
- **Ab saare 7 OTOs worst-case me bhi profitable hain** ✅
- **Story Book ab admin-only** hai (kisi OTO me nahi) — isliye sabse mehenga engine funnel se bahar.
  Isi se Creator Suite ka purana loss-risk khatam ho gaya (ab worst engine coloring ~$0.01/cr).
- **Unlimited** metered nahi — ek determined heavy user (coloring/cover v2 spam) ongoing cost badha
  sakta hai. One-time payment hai, isliye fair-use cap recommend.

### ✅ Fair-use caps — IMPLEMENTED (`lib/billing/caps.ts`)
Sab pe apply (Unlimited included), `usage_events` se rolling count, guard me enforce → 429.

| Cap | Daily | Monthly (rolling 30d) |
|-----|-------|-----------------------|
| **Books** (koi bhi book engine) | 10 | 100 |
| **Images** (coloring, story, cover v2) | 5 | 50 |

Image book dono caps me count hota hai. Non-book (niche/title/publish/cover v1) pe cap nahi.
**Unlimited worst-case ab bounded:** max 50 image books/month × ~$0.025 = **~$1.25/month**.

### Unlimited downsell — FINALIZED (Option A, credit pack)
| | Price | Credits | Engines |
|---|-------|---------|---------|
| Unlimited (full) | $67 | ♾️ credit-free | sab 20 public |
| **Unlimited Lite (downsell)** | $47 | **1,000** (metered) | sab public **except Cover V2** |

**Kyun 1,000 safe:** worst-case saara coloring pe (~$0.01/cr) = ~$10 < net $16.45 → profit ~$6.45.
Upar se caps bhi bound karte hain. Cover V2 sirf full Unlimited me (upgrade reason).

---

## Note (code)
Cover V2 ab sirf **GPT Image 2** (`openai/gpt-image-2`) use karta hai — baaki models
(`Flux 2 Klein`, `Leonardo Lucid`, `Leonardo Phoenix`, `Ideogram v3`) picker se hata diye.
V2 ko chalane ke liye server pe `REPLICATE_API_TOKEN` + `COVER_V2_ENABLED=1` chahiye.
