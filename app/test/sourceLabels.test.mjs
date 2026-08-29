import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_SOURCE_LABEL_CHARS,
  normalizeUrl,
  friendlyUrlLabel,
  resolveSourceLabel,
  truncateLabel,
} from "../src/home/components/chat/sourceLabels.js";

/* Web citations only started reaching the UI once the streaming controller
   stopped reading node.url off the score wrapper, so these labels are new -
   and an unbounded one widens the whole reply bubble. */

test("truncateLabel leaves short labels untouched", () => {
  assert.equal(truncateLabel("expedia.com"), "expedia.com");
  assert.equal(truncateLabel(""), "");
  assert.equal(truncateLabel(undefined), "");
});

test("truncateLabel bounds a long label and marks the cut", () => {
  const long =
    "expedia.com | newsroom / expedia-launches-new-flight-deals-canada";
  const out = truncateLabel(long);
  assert.ok(
    out.length <= MAX_SOURCE_LABEL_CHARS,
    `got ${out.length} chars: ${out}`
  );
  assert.ok(out.endsWith("…"));
  assert.ok(long.startsWith(out.slice(0, 10)));
});

test("truncateLabel prefers a word boundary when one is near the cut", () => {
  const out = truncateLabel(
    "york university faculty of liberal arts and professional studies"
  );
  assert.ok(out.endsWith("…"));
  assert.ok(
    !/\s…$/.test(out),
    "should not leave a dangling space before the ellipsis"
  );
  // Cut at a space, so the last visible chunk is a whole word.
  assert.ok(!out.slice(0, -1).endsWith("-"));
});

test("truncateLabel still bounds a single unbroken token", () => {
  const out = truncateLabel("a".repeat(200));
  assert.ok(out.length <= MAX_SOURCE_LABEL_CHARS);
  assert.ok(out.endsWith("…"));
});

test("friendlyUrlLabel drops www and keeps at most two path segments", () => {
  assert.equal(friendlyUrlLabel("https://www.expedia.com/"), "expedia.com");
  assert.equal(
    friendlyUrlLabel("https://expedia.com/newsroom/flight-deals/extra/more"),
    "expedia.com | newsroom / flight-deals"
  );
});

test("resolveSourceLabel bounds a long title from a web citation", () => {
  const label = resolveSourceLabel({
    type: "web",
    label:
      "Expedia Launches New Flight Deals Feature To Help Canadians Find Value Airfares",
    metadata: { url: "https://expedia.com/newsroom/flight-deals" },
  });
  assert.ok(
    label.length <= MAX_SOURCE_LABEL_CHARS,
    `got ${label.length} chars: ${label}`
  );
});

test("resolveSourceLabel bounds a url-derived label too", () => {
  const label = resolveSourceLabel({
    type: "web",
    label:
      "https://expedia.com/newsroom/expedia-launches-new-flight-deals-in-canada",
    metadata: {
      url: "https://expedia.com/newsroom/expedia-launches-new-flight-deals-in-canada",
    },
  });
  assert.ok(
    label.length <= MAX_SOURCE_LABEL_CHARS,
    `got ${label.length} chars: ${label}`
  );
  assert.ok(label.startsWith("expedia.com"));
});

test("resolveSourceLabel falls back when there is no usable url", () => {
  assert.equal(
    resolveSourceLabel({ type: "file", label: "Syllabus.pdf" }),
    "Syllabus.pdf"
  );
  assert.equal(resolveSourceLabel({}), "Source");
});

/* Citation URLs come from web-search results, i.e. externally controlled text.
   normalizeUrl is what stops a non-http scheme reaching window.open/href. */

test("normalizeUrl accepts http and https", () => {
  assert.equal(normalizeUrl("https://yorku.ca/a"), "https://yorku.ca/a");
  assert.equal(normalizeUrl("http://yorku.ca/a"), "http://yorku.ca/a");
});

test("normalizeUrl upgrades a bare host to https", () => {
  assert.equal(normalizeUrl("yorku.ca"), "https://yorku.ca/");
});

test("normalizeUrl never returns a non-http(s) scheme", () => {
  for (const hostile of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html;base64,PHN2Zz4=",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
  ]) {
    const out = normalizeUrl(hostile);
    if (out !== null) {
      assert.match(out, /^https?:\/\//, `${hostile} normalized to ${out}`);
      assert.ok(!/^javascript:/i.test(out));
    }
  }
});

test("normalizeUrl rejects empty and non-string input", () => {
  assert.equal(normalizeUrl(""), null);
  assert.equal(normalizeUrl("   "), null);
  assert.equal(normalizeUrl(null), null);
  assert.equal(normalizeUrl(undefined), null);
  assert.equal(normalizeUrl(42), null);
});

test("normalizeUrl strips embedded whitespace used to hide a scheme", () => {
  const out = normalizeUrl("java\nscript:alert(1)");
  if (out !== null) {
    assert.match(out, /^https?:\/\//);
  }
});
