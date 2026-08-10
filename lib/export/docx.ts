/**
 * Ebook → editable DOCX (Word) using the `docx` library. Markdown chapter
 * content is converted to Word paragraphs (headings, paragraphs, bullet lists,
 * bold/italic).
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import { marked, type Token, type Tokens } from "marked";
import type { EbookData } from "../generators/ebook/types";

type InlineToken = Tokens.Text | Tokens.Strong | Tokens.Em | Tokens.Codespan | Tokens.Link | Tokens.Br | Token;

function inlineRuns(tokens: InlineToken[] | undefined, text: string): TextRun[] {
  if (!tokens || tokens.length === 0) return [new TextRun(text)];
  const runs: TextRun[] = [];
  const walk = (toks: InlineToken[], bold = false, italics = false) => {
    for (const t of toks) {
      const tok = t as { type: string; text?: string; tokens?: InlineToken[] };
      if (tok.type === "strong") walk(tok.tokens ?? [], true, italics);
      else if (tok.type === "em") walk(tok.tokens ?? [], bold, true);
      else if (tok.type === "br") runs.push(new TextRun({ text: "", break: 1 }));
      else runs.push(new TextRun({ text: tok.text ?? "", bold, italics }));
    }
  };
  walk(tokens);
  return runs.length ? runs : [new TextRun(text)];
}

function mdToParagraphs(md: string): Paragraph[] {
  const tokens = marked.lexer(md);
  const out: Paragraph[] = [];
  for (const t of tokens) {
    if (t.type === "heading") {
      const h = t as Tokens.Heading;
      out.push(
        new Paragraph({
          heading: h.depth <= 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          children: inlineRuns(h.tokens, h.text),
        })
      );
    } else if (t.type === "paragraph") {
      const p = t as Tokens.Paragraph;
      out.push(new Paragraph({ children: inlineRuns(p.tokens, p.text) }));
    } else if (t.type === "list") {
      const l = t as Tokens.List;
      for (const item of l.items) {
        out.push(
          new Paragraph({
            bullet: { level: 0 },
            children: inlineRuns((item as Tokens.ListItem).tokens as InlineToken[], item.text),
          })
        );
      }
    } else if (t.type === "blockquote") {
      const b = t as Tokens.Blockquote;
      out.push(new Paragraph({ children: [new TextRun({ text: b.text, italics: true })] }));
    } else if (t.type === "code") {
      out.push(new Paragraph({ children: [new TextRun({ text: (t as Tokens.Code).text })] }));
    }
  }
  return out;
}

export async function buildDocx(book: EbookData): Promise<Uint8Array> {
  const children: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(book.title)] }),
  ];
  if (book.subtitle) children.push(new Paragraph({ children: [new TextRun({ text: book.subtitle, italics: true })] }));
  children.push(new Paragraph({ children: [new TextRun(book.author)] }));

  for (const c of book.chapters) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        children: [new TextRun(`Chapter ${c.idx}: ${c.title}`)],
      })
    );
    children.push(...mdToParagraphs(c.contentMd));
  }

  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}
