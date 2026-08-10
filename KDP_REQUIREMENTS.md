# Amazon KDP Print Requirements

The spec rules encoded in [lib/pdf/kdp-specs.ts](lib/pdf/kdp-specs.ts). Source:
Amazon KDP Help (US paperback). These are compliance-by-construction inputs to
the PDF engine.

## Trim sizes (supported)

| Trim | Width × Height (in) |
|---|---|
| 6×9 | 6 × 9 |
| 8×10 | 8 × 10 |
| **8.5×11** (production default) | 8.5 × 11 |

## Bleed

- Bleed allowance: **0.125"**.
- When enabled, the PDF page grows beyond the trim (KDP trims it back):
  - width += 0.125" (outer edge)
  - height += 0.25" (top + bottom)
- **Default: no bleed** for text/puzzle interiors. Enabled only for Coloring
  Books (edge-to-edge art), later phase.

## Interior margins

**Inside / gutter margin (grows with page count):**

| Page count | Min gutter |
|---|---|
| 24–150 | 0.375" |
| 151–300 | 0.5" |
| 301–500 | 0.625" |
| 501–700 | 0.75" |
| 701–828 | 0.875" |

**Outside margin (top/bottom/outer):** 0.25" (no bleed) / 0.375" (bleed).

The engine adds a **0.125" safety** on top of these minimums by default.

Minimum interior page count: **24**.

## Cover (wraparound paperback)

- Single PDF spanning **back | spine | front** plus bleed on all four sides.
- **Spine width = pageCount × per-page thickness:**

  | Paper stock | Thickness / page |
  |---|---|
  | White | 0.002252" |
  | Cream | 0.0025" |
  | Color (standard) | 0.002252" |
  | Color (premium) | 0.002347" |

- **Full cover width** = `0.125 + trimW + spine + trimW + 0.125`
- **Full cover height** = `0.125 + trimH + 0.125`
- **Spine text** allowed only when page count ≥ **79**.
- Keep text/important art ≥ **0.25"** from every trim edge and spine fold.

## Other

- Raster assets ≥ **300 DPI** (`KDP_MIN_DPI`). Text/vector is resolution-independent.
- **Fonts must be embedded** — Chromium subsets + embeds automatically via Puppeteer.
- Output: standard PDF accepted (PDF/X not required).

## Validation

1. Automated geometry check: `npm run gate:verify` (page count + physical size).
2. **Authoritative:** upload interior + cover to KDP and pass Launch Previewer.
   Steps in [README.md](README.md).
