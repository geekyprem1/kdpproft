# Sample Books — KDP Upload Testing

Three production-quality word search books for validating the pipeline against
Amazon KDP. All are **8.5×11, no-bleed, white paper, 83 pages**, with title page,
puzzle pages, and a complete highlighted answer key.

| Book | Folder | Pages | Spine |
|---|---|---|---|
| Dinosaur Word Search | `dinosaur-word-search/` | 83 | 0.187in (spine text) |
| Halloween Word Search | `halloween-word-search/` | 83 | 0.187in (spine text) |
| Christmas Word Search | `christmas-word-search/` | 83 | 0.187in (spine text) |

Each folder contains:

```
<slug>-interior.pdf      # upload as the manuscript     (gitignored — regenerate)
<slug>-cover.pdf         # upload as the cover           (gitignored — regenerate)
previews/                # 01-title, 02-puzzle, 03-solution, 04-cover (PNG)
```

The interior/cover PDFs are large and regenerable, so they are **not committed**.
Recreate them anytime:

```bash
npm run examples:generate   # writes all PDFs + previews + manifest.json
npm run examples:validate    # re-runs KDP checks → VALIDATION.md
```

## KDP upload steps (per book)

1. KDP → Create → Paperback.
2. Trim **8.5×11**, paper **White**, **no-bleed** interior.
3. Upload `<slug>-interior.pdf` as the manuscript.
4. Upload `<slug>-cover.pdf` as the cover (spine sized for 83 pages).
5. Open **Launch Previewer** and confirm no margin/trim/spine/DPI errors.

See [VALIDATION.md](VALIDATION.md) for the automated check results.
