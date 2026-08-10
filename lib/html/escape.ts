/** Escape untrusted text for insertion into HTML or XML text/attribute contexts. */
export function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Keep only URLs whose explicit protocol is safe for document links. Relative
 * URLs are retained; control/whitespace-obfuscated protocols are rejected.
 */
export function sanitizeUrl(
  value: string,
  allowedProtocols: readonly string[] = ["http:", "https:", "mailto:"]
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/[\u0000-\u0020\u007f-\u009f]/g, "");
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(compact)?.[1]?.toLowerCase();
  if (scheme && !allowedProtocols.includes(`${scheme}:`)) return null;
  return trimmed;
}
