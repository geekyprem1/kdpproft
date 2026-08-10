# KDP Pocket AI — Product Requirements

**Version:** v1.0 MVP
**Type:** AI-powered Amazon KDP book creation platform

## Vision

Let anyone create complete, Amazon KDP-ready books in minutes. The user enters a
niche; the system generates content, covers, metadata, and print-ready PDFs. No
design or writing skills required.

**Core promise:** *"Create and publish Amazon KDP books in minutes instead of days."*

## Target market

JVZoo / WarriorPlus buyers, side hustlers, Amazon KDP publishers, digital
product creators.

## Supported book types (MVP)

| Type | Generation | AI image? | Phase |
|---|---|---|---|
| Word Search | deterministic algorithm | no | **current** |
| Sudoku | deterministic algorithm | no | after Word Search |
| Maze | deterministic algorithm | no | after Sudoku |
| Planner | template fill | no | later |
| Coloring Book | Replicate FLUX | **yes** | later (enables bleed) |

## User workflow

1. **Login** — Supabase Auth (Google / email).
2. **Choose book type.**
3. **Enter niche/theme** (e.g. "Dinosaurs").
4. **Configure** — page/puzzle count, trim size, difficulty, age group.
5. **Generate** — async pipeline (Trigger.dev) builds content → assembles pages
   → renders PDF → writes metadata.
6. **Preview** — sample pages, cover, metadata.
7. **Export** — interior PDF, cover PDF, metadata file.

## Features

- **Puzzle generators** (Word Search, Sudoku, Maze): puzzle pages + solution
  pages, deterministic, solver-verified.
- **Coloring generator** (later): B/W thick-line pages via FLUX.
- **Cover creator**: wraparound front/spine/back sized to KDP spec.
- **Metadata generator** (via OpenRouter): title, subtitle, 7 keywords,
  description, backend keywords.
- **KDP formatter**: trims 6×9 / 8×10 / 8.5×11; margins, bleed, gutter, spine,
  page numbering handled automatically.
- **Commercial license**: users keep 100% of profit.

## Credit system

| Item | Credits |
|---|---|
| Coloring page | 1 |
| Word Search book | 10 |
| Sudoku book | 10 |
| Planner | 10 |
| Full coloring book | 25 |

> ⚠️ Open item: per-page (1/page) vs. fixed-bundle pricing conflict — resolved in
> [DECISIONS.md](DECISIONS.md) before billing is built.

## AI stack

- **Text** (metadata, titles, descriptions, niche ideas, image prompts):
  **OpenRouter** — primary `google/gemini-2.5-flash`, fallback
  `deepseek/deepseek-v4-flash`. (Claude removed.)
- **Images** (coloring/cover art, later): Replicate **FLUX Schnell**.

## Technical stack

Next.js · Shadcn UI · TailwindCSS · Supabase (Postgres + Auth) · Cloudflare R2 ·
Stripe · Trigger.dev (background jobs) · Puppeteer (PDF).

## Pricing

Frontend $27 · OTO1 Unlimited $67 · OTO2 Agency $97 · OTO3 DFY Templates $47 ·
OTO4 Whitelabel $197.

## Success metrics

- Complete book in < 5 minutes
- PDF export success rate > 99%
- Cost per book < $0.30
- First sale within 30 days of launch

## Later phases

Storybooks, character consistency, bulk generation, niche research,
multi-language, team accounts, API access, one-click "agent mode."
