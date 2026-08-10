/**
 * Ebook → reflowable 6×9 print PDF (title page, table of contents, chapters)
 * via the existing Puppeteer engine.
 */

import { renderSafeMarkdown } from "../html/markdown";
import { escapeHtml } from "../html/escape";
import { renderPdfFromCss } from "../pdf";
import type { EbookData } from "../generators/ebook/types";

const esc = escapeHtml;
const md = renderSafeMarkdown;

export async function buildEbookPdf(book: EbookData): Promise<Uint8Array> {
  const toc = book.chapters
    .map((c) => `<li><span class="ci">${esc(c.idx)}.</span> ${esc(c.title)}</li>`)
    .join("");

  const chapters = book.chapters
    .map(
      (c) => `
      <section class="chapter">
        <div class="ch-num">Chapter ${esc(c.idx)}</div>
        <h1 class="ch-title">${esc(c.title)}</h1>
        ${md(c.contentMd)}
      </section>`
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
    @page { size: 6in 9in; margin: 0.75in; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, "Times New Roman", serif; color: #111; font-size: 11.5pt; line-height: 1.55; }
    h1, h2, h3 { font-family: Georgia, serif; }
    p { margin: 0 0 0.16in; text-align: justify; }
    ul, ol { margin: 0 0 0.16in 0.25in; }
    .title-page { height: 7.5in; display: flex; flex-direction: column; justify-content: center; text-align: center; page-break-after: always; }
    .title-page h1 { font-size: 30pt; margin: 0 0 0.1in; }
    .title-page .sub { font-size: 14pt; color: #555; font-style: italic; }
    .title-page .author { margin-top: 0.6in; font-size: 13pt; }
    .toc { page-break-after: always; }
    .toc h2 { font-size: 18pt; border-bottom: 2px solid #111; padding-bottom: 4pt; }
    .toc ul { list-style: none; padding: 0; }
    .toc li { padding: 4pt 0; border-bottom: 1px dotted #ccc; }
    .toc .ci { display: inline-block; width: 0.35in; color: #777; }
    .chapter { page-break-before: always; }
    .ch-num { color: #888; font-size: 10pt; letter-spacing: 0.1em; text-transform: uppercase; }
    .ch-title { font-size: 22pt; margin: 0.02in 0 0.25in; }
    h2 { font-size: 14pt; margin: 0.2in 0 0.08in; }
  </style></head><body>
    <div class="title-page">
      <h1>${esc(book.title)}</h1>
      ${book.subtitle ? `<div class="sub">${esc(book.subtitle)}</div>` : ""}
      <div class="author">${esc(book.author)}</div>
    </div>
    <div class="toc"><h2>Contents</h2><ul>${toc}</ul></div>
    ${chapters}
  </body></html>`;

  return renderPdfFromCss(html);
}
