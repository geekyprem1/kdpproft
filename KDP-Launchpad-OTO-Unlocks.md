# KDP Launchpad — Full Feature Audit + OTO Unlock Map

> Yeh file poore SaaS ka actual audit hai (source: `lib/billing/plans.ts`,
> `lib/billing/cost.ts`, nav, API routes). Har OTO me **kya khulega / kya locked
> rahega** ki complete list. Credits ki baat iske baad.

---

## PART A — Pura SaaS Inventory

Total **21 gated features** = **14 book engines** + **7 tool/system engines**.
(Plus DFY library, Agency service, Reseller/white-label service.)

### 📘 Book-generation engines (14)

**Puzzle Books (7)**
| Engine | Route | AI? |
|--------|-------|-----|
| Word Search | `/dashboard/word-search` | No (offline) |
| Sudoku | `/dashboard/sudoku` | No |
| Maze | `/dashboard/maze` | No |
| Crossword | `/dashboard/crossword` | Semi (AI clues) |
| Word Scramble | `/dashboard/scramble` | No |
| Cryptogram | `/dashboard/cryptogram` | No |
| Connect the Dots | `/dashboard/dot-to-dot` | No |

**Kids & Learning (5)**
| Engine | Route | AI? |
|--------|-------|-----|
| Coloring Book | `/dashboard/coloring` | Yes (AI images) |
| Activity Book | `/dashboard/activity` | Semi (mixes engines) |
| Tracing Workbook | `/dashboard/tracing` | No |
| Math Workbook | `/dashboard/math` | No |
| Story Book | `/dashboard/story` | Yes (AI illustrations) |

**Low-Content & Text (2)**
| Engine | Route | AI? |
|--------|-------|-----|
| Journals & Planners (low-content) | `/dashboard/lowcontent` | No |
| Ebook Creator | `/dashboard/ebook-creator` | Yes (AI text) |

### 🛠 Tool / System engines (7)

| Engine | Route | Kya karta hai |
|--------|-------|---------------|
| Market Intelligence™ (Niche + Opportunity) | `/dashboard/niche` | Niche research + opportunity scoring |
| Title Optimizer | `/dashboard/title-optimizer` | Amazon SEO title/subtitle |
| Cover Studio (V1) | `/dashboard/cover` | AI/template covers |
| Cover Studio V2 (Beta) | `/dashboard/cover-v2` | Premium covers (env-gated) |
| Publish Package (Launch Kit) | `publish-package` | Keywords, categories, description |
| Publishing Factory™ (Bundle/Bulk) | `/dashboard/bundle` | Bulk + bundle/box-set production |
| Book Autopilot | `/dashboard/autopilot` | Auto niche→write→cover→package (3 books/run) |

### 📦 Non-generator deliverables
- **DFY Library** (`/dashboard/dfy`) — ready-made downloadable books (admin uploads)
- **Agency** (`/dashboard/agency`) — client service (manual setup)
- **Reseller / White-label** (`/dashboard/reseller`) — resell + branding (manual setup)

---

## PART B — Current Gating (default, without OTOs)

Front End ($17) = **tier 1**. Yeh 12 features shaamil hain by default:

Market Intelligence, Title Optimizer, Publish Package, Word Search, Sudoku, Maze,
Journals & Planners, Tracing, Math, Word Scramble, Cryptogram, Connect-the-Dots.

Baaki 9 features FE pe **locked** hain aur OTO se khulte hain (neeche map).

---

## PART C — Per-OTO Unlock List (UPDATED FUNNEL — 7 OTOs)

> Har OTO buyer ke paas FE pehle se hai, toh OTO uske upar stack hota hai.

### FE — KDP Launchpad Commercial ($17)
**Khulega:** 12 tier-1 features (upar list) + 120 credits + commercial license
**Locked:** Coloring, Cover Studio, Crossword, Activity, Ebook, Story Book,
Factory, Autopilot, Cover V2, DFY Library

---

### OTO1 — Creator Suite ($37 / downsell $27) 🆕
**Khulega:** 5 premium engines — Coloring, Cover Studio, Ebook Creator,
Crossword, Activity Book + 600 credits
**Locked:** Cover V2, Factory, Autopilot, DFY
**Entitlement:** `coloring` + `cover` + `ebook` + `crossword` + `activity`
**Note:** Story Book kisi OTO me nahi — **admin-only** internal tool.

---

### OTO2 — Unlimited Edition ($67 / downsell $47)
**Khulega:** 🔓 saare **20 public** engines + DFY + credit-free generation
**Locked:** kuch nahi (public) — Story Book sirf admin
**Entitlement:** `unlimited`

---

### OTO3 — Done-For-You ($67 / downsell $47)
**Khulega:** DFY Library — ready-made publish-ready books download
**Locked:** Generators pe asar nahi (sirf download library)
**Entitlement:** `dfy_assets`

---

### OTO4 — Autopilot / Automation ($97 / downsell $67)
**Khulega:** Book Autopilot + Publishing Factory™ + 1,500 credits
**Locked:** premium engines (jab tak Creator Suite/Unlimited na ho), Cover V2, DFY
**Entitlement:** `autopilot` + `factory`

---

### OTO5 — Bundle & Series Empire ($47 / downsell $37)
**Khulega:** Publishing Factory™ (bundles, box-sets, series) + 800 credits
**Locked:** Autopilot, premium engines, Cover V2, DFY
**Entitlement:** `factory`

---

### OTO6 — Agency / Client ($97 / downsell $67)
**Khulega:** Coloring + Cover + Ebook + 1,200 credits + Agency service (manual setup)
**Locked:** Crossword, Activity, Story Book, Cover V2, Factory, Autopilot, DFY
**Entitlement:** `agency` + `cover` + `ebook` + `coloring`

---

### OTO7 — Reseller / Whitelabel ($197 / downsell $97)
**Khulega:** Coloring + Cover + Ebook + White-label + Reseller accounts (manual setup) + 2,500 credits
**Locked:** Crossword, Activity, Story Book, Cover V2, Factory, Autopilot, DFY
**Entitlement:** `reseller` + `white_label` + `cover` + `ebook` + `coloring`

---

## PART D — Unlock Matrix (feature × OTO)

✅ = unlock · — = locked · (FE column = Front End default)

| Feature / Engine | FE | Creator | Unlimited | DFY | Autopilot | Bundle | Agency | Reseller |
|------------------|----|---------|-----------|-----|-----------|--------|--------|----------|
| Market Intelligence | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Title Optimizer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Publish Package | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Word Search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sudoku | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Maze | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Journals & Planners | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tracing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Math | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Word Scramble | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cryptogram | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Connect-the-Dots | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Coloring Book | — | ✅ | ✅ | — | — | — | ✅ | ✅ |
| Cover Studio (V1) | — | ✅ | ✅ | — | — | — | ✅ | ✅ |
| Ebook Creator | — | ✅ | ✅ | — | — | — | ✅ | ✅ |
| Crossword | — | ✅ | ✅ | — | — | — | — | — |
| Activity Book | — | ✅ | ✅ | — | — | — | — | — |
| Story Book | 🔒 admin-only — kisi OTO me nahi | | | | | | | |
| Cover Studio V2 | — | — | ✅ | — | — | — | — | — |
| Publishing Factory | — | — | ✅ | — | ✅ | ✅ | — | — |
| Book Autopilot | — | — | ✅ | — | ✅ | — | — | — |
| DFY Library | — | — | ✅ | ✅ | — | — | — | — |
| White-label | — | — | ✅ | — | — | — | — | ✅ |

---

## PART E — Engine access notes

- **Story Book** kisi OTO me nahi — **admin-only** internal tool (sabse mehenga image engine).
  Normal users ko nav me dikhta bhi nahi; API + create-wizard bhi admin-gated.
- **Cover Studio V2** sirf Unlimited (Beta + paid, GPT Image 2 only).
- Crossword / Activity → Creator Suite + Unlimited.

---

## Quick summary (naya funnel)
- **21 features** total; **20 public** + 1 admin-only (Story Book) · **7 OTOs**
- **FE ($17)**: 12 features
- **OTO1 Creator Suite ($37)**: 5 premium engines 🆕
- **OTO2 Unlimited ($67)**: sab 20 public + DFY, credit-free
- **OTO3 DFY ($67)** · **OTO4 Autopilot ($97)** · **OTO5 Bundle ($47)**
- **OTO6 Agency ($97)** · **OTO7 Reseller ($197)** — sab me downsell
- **Admin-only:** Story Book · **Unlimited-only:** Cover Studio V2
