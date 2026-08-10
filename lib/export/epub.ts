/**
 * Ebook → EPUB3 (reflowable) built with JSZip. One XHTML doc per chapter + a
 * nav document + the OPF package. Reader-store friendly (Apple/Kobo/Google).
 */

import JSZip from "jszip";
import { escapeHtml } from "../html/escape";
import { renderSafeMarkdown } from "../html/markdown";
import type { EbookData } from "../generators/ebook/types";

const esc = escapeHtml;

function xhtml(title: string, bodyHtml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en" lang="en">
<head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>body{font-family:serif;line-height:1.5;margin:1em} h1{font-size:1.6em} h2{font-size:1.2em} p{margin:0 0 0.8em;text-align:justify}</style>
</head><body>${bodyHtml}</body></html>`;
}

function chapterHtml(title: string, contentMd: string): string {
  const inner = renderSafeMarkdown(contentMd);
  return xhtml(title, `<h1>${esc(title)}</h1>\n${inner}`);
}

export async function buildEpub(book: EbookData): Promise<Uint8Array> {
  const zip = new JSZip();
  const uid = `urn:uuid:${crypto.randomUUID()}`;
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  // EPUB requires an uncompressed "mimetype" entry, added first.
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
  );

  // Title page + chapters
  const files: Array<{ id: string; href: string; title: string }> = [];
  zip.file(
    "OEBPS/title.xhtml",
    xhtml(book.title, `<h1>${esc(book.title)}</h1>${book.subtitle ? `<p><em>${esc(book.subtitle)}</em></p>` : ""}<p>${esc(book.author)}</p>`)
  );
  files.push({ id: "title", href: "title.xhtml", title: book.title });

  book.chapters.forEach((c, index) => {
    const chapterNumber = index + 1;
    const href = `chapter-${chapterNumber}.xhtml`;
    zip.file(`OEBPS/${href}`, chapterHtml(c.title, c.contentMd));
    files.push({ id: `ch${chapterNumber}`, href, title: `${c.idx}. ${c.title}` });
  });

  // nav
  const navLis = files
    .map((f) => `<li><a href="${esc(f.href)}">${esc(f.title)}</a></li>`)
    .join("");
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
<head><meta charset="utf-8"/><title>Contents</title></head>
<body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol>${navLis}</ol></nav></body></html>`
  );

  // OPF
  const manifest = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    ...files.map((f) => `<item id="${esc(f.id)}" href="${esc(f.href)}" media-type="application/xhtml+xml"/>`),
  ].join("\n    ");
  const spine = files.map((f) => `<itemref idref="${esc(f.id)}"/>`).join("\n    ");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${uid}</dc:identifier>
    <dc:title>${esc(book.title)}</dc:title>
    <dc:creator>${esc(book.author)}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${now}</meta>
  </metadata>
  <manifest>
    ${manifest}
  </manifest>
  <spine>
    ${spine}
  </spine>
</package>`
  );

  const buf = await zip.generateAsync({ type: "uint8array", mimeType: "application/epub+zip" });
  return buf;
}
