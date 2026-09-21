/**
 * Ebook cover generator — a clean typographic front cover (gradient + title +
 * author), rendered to PNG. No external image model required (works offline).
 * AI background art is a future enhancement.
 */

import { renderPng } from "../../pdf/render";
import { hashSeed } from "../../util/prng";
import { TRIM_SIZES, KDP_MIN_DPI, type TrimSize } from "../../pdf/kdp-specs";

const PALETTES: Array<[string, string]> = [
  ["#1e3a8a", "#3b82f6"],
  ["#065f46", "#10b981"],
  ["#7c2d12", "#ea580c"],
  ["#581c87", "#a855f7"],
  ["#831843", "#ec4899"],
  ["#0f172a", "#334155"],
  ["#134e4a", "#14b8a6"],
];

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export interface EbookCoverInput {
  title: string;
  subtitle?: string;
  author: string;
  /** KDP trim size; the cover must match the interior's declared trim. */
  trim?: TrimSize;
}

/** Front-cover PNG at the requested KDP trim size (defaults to 6×9). */
export async function buildEbookCover(input: EbookCoverInput): Promise<Uint8Array> {
  const trim = input.trim && input.trim in TRIM_SIZES ? input.trim : "6x9";
  const { widthIn, heightIn } = TRIM_SIZES[trim];
  const [c1, c2] = PALETTES[hashSeed(input.title) % PALETTES.length];
  // Long titles would clip the cover at a fixed 46pt — shrink the type as the
  // title grows so the layout always fits within the trim.
  const titleSize = input.title.length > 80 ? 30 : input.title.length > 50 ? 36 : input.title.length > 32 ? 41 : 46;
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;padding:0}
    .cover{width:100vw;height:100vh;box-sizing:border-box;
      background:linear-gradient(150deg,${c1},${c2});
      color:#fff;font-family:Georgia,'Times New Roman',serif;
      display:flex;flex-direction:column;justify-content:space-between;
      padding:0.9in 0.8in;text-align:center}
    .top{margin-top:0.6in}
    .title{font-size:${titleSize}pt;font-weight:bold;line-height:1.1;margin:0}
    .rule{width:1.6in;height:3px;background:rgba(255,255,255,0.85);margin:0.3in auto}
    .subtitle{font-size:17pt;opacity:0.92;margin:0;font-style:italic}
    .author{font-size:18pt;letter-spacing:0.05em;opacity:0.95;margin-bottom:0.4in}
  </style></head><body>
    <div class="cover">
      <div class="top">
        <h1 class="title">${esc(input.title)}</h1>
        <div class="rule"></div>
        ${input.subtitle ? `<p class="subtitle">${esc(input.subtitle)}</p>` : ""}
      </div>
      <div class="author">${esc(input.author)}</div>
    </div>
  </body></html>`;
  return renderPng(html, { widthIn, heightIn, dpi: KDP_MIN_DPI });
}
