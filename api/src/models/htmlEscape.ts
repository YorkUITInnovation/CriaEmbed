/**
 * Escape a string for safe interpolation into an HTML attribute value.
 * Neutralises attribute/tag breakout; the browser HTML-decodes the value back
 * to the original on read, so CSS attribute selectors still match.
 */
export function htmlAttrEscape(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Escape plain text for HTML element content. */
export function htmlTextEscape(value: string): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
