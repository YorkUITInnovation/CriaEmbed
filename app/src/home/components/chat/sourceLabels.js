/**
 * Pure label helpers for source citation pills.
 *
 * Kept in a plain .js module (no JSX) so they can be tested directly.
 */

/* Pills sit inline in the reply, so an unbounded label (a long article slug, a
   full page title) makes a single source dominate the row. CSS clips it too;
   this keeps the text itself sensible - the pill's title attribute and the
   popover still carry the full value. */
export const MAX_SOURCE_LABEL_CHARS = 42;

export function normalizeUrl(rawUrl) {
  if (typeof rawUrl !== "string") return null;

  const compact = rawUrl.trim().replace(/\s+/g, "");
  if (!compact) return null;

  const candidates = /^https?:\/\//i.test(compact)
    ? [compact]
    : [`https://${compact}`];

  for (const candidate of candidates) {
    try {
      const parsed = new URL(candidate);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        continue;
      }
      return parsed.toString();
    } catch (_error) {
      // Try next candidate.
    }
  }

  return null;
}

export function truncateLabel(label, maxChars = MAX_SOURCE_LABEL_CHARS) {
  const text = String(label ?? "").trim();
  if (text.length <= maxChars) return text;
  // Trim back to a word boundary when one is close, so we don't cut mid-word.
  const clipped = text.slice(0, maxChars - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  const base =
    lastSpace > maxChars * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${base.trimEnd()}…`;
}

export function friendlyUrlLabel(urlString) {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.replace(/^www\./i, "");
    const path = parsed.pathname
      .replace(/\/$/, "")
      .split("/")
      .filter(Boolean)
      .slice(0, 2)
      .join(" / ");

    return path ? `${host} | ${path}` : host;
  } catch (_error) {
    return urlString;
  }
}

export function resolveSourceLabel(source) {
  const rawLabel = typeof source?.label === "string" ? source.label.trim() : "";
  const normalizedUrl = normalizeUrl(source?.metadata?.url);

  if (rawLabel && !/^https?:\/\//i.test(rawLabel)) {
    return truncateLabel(rawLabel);
  }

  if (normalizedUrl) {
    return truncateLabel(friendlyUrlLabel(normalizedUrl));
  }

  return truncateLabel(rawLabel || source?.display || "Source");
}
