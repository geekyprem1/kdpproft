/**
 * Ebook cover generator — a clean typographic front cover (gradient + title +
 * author), rendered to PNG. No external image model required (works offline).
 * AI background art is a future enhancement.
 */

import { renderPng } from "../../pdf/render";
import { hashSeed } from "../../util/prng";

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
}

/** 6×9 portrait front cover PNG. */
export async function buildEbookCover(input: EbookCoverInput): Promise<Uint8Array> {
  const [c1, c2] = PALETTES[hashSeed(input.title) % PALETTES.length];
  const html = `<!doctype html><html><head><style>
    html,body{margin:0;padding:0}
    .cover{width:100vw;height:100vh;box-sizing:border-box;
      background:linear-gradient(150deg,${c1},${c2});
      color:#fff;font-family:Georgia,'Times New Roman',serif;
      display:flex;flex-direction:column;justify-content:space-between;
      padding:0.9in 0.8in;text-align:center}
    .top{margin-top:0.6in}
    .title{font-size:46pt;font-weight:bold;line-height:1.1;margin:0}
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
  return renderPng(html, { widthIn: 6, heightIn: 9, dpi: 150 });
}
