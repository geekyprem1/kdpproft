import { marked } from "marked";
import { escapeHtml, sanitizeUrl } from "./escape";

const renderer = new marked.Renderer();

// Markdown formatting is trusted; embedded raw HTML is not.
renderer.html = ({ text }) => escapeHtml(text);
renderer.link = function ({ href, title, tokens }) {
  const label = this.parser.parseInline(tokens);
  const safeHref = sanitizeUrl(href);
  if (!safeHref) return label;
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<a href="${escapeHtml(safeHref)}"${titleAttr}>${label}</a>`;
};
renderer.image = ({ href, title, text }) => {
  const safeSrc = sanitizeUrl(href, ["http:", "https:"]);
  if (!safeSrc) return escapeHtml(text);
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(text)}"${titleAttr} />`;
};

/** Convert untrusted Markdown to formatting-only HTML. */
export function renderSafeMarkdown(source: string): string {
  return marked.parse(source, { async: false, renderer }) as string;
}
