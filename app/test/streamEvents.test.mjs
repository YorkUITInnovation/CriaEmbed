import test from "node:test";
import assert from "node:assert/strict";

import { StreamingChatHandler } from "../src/home/utils/StreamingChatHandler.js";

function setup() {
  const handler = new StreamingChatHandler(
    "bot-1",
    "chat-1",
    "http://api.test"
  );
  const result = {
    message: "",
    status_events: [],
    citations: [],
    errors: [],
    elapsed_ms: 0,
    web_search: null,
  };
  const seen = { status: [], chunks: [], citations: [], errors: [] };
  const callbacks = {
    onStatus: (engine, state, message) =>
      seen.status.push({ engine, state, message }),
    onChunk: (c) => seen.chunks.push(c),
    onCitations: (s) => seen.citations.push(s),
    onError: (e) => seen.errors.push(e),
  };
  return { handler, result, seen, callbacks };
}

test("status events are collected and forwarded verbatim", () => {
  const { handler, result, seen, callbacks } = setup();
  handler._handleEvent(
    {
      type: "status",
      engine: "web_search",
      state: "error",
      message: "⚠ unavailable",
    },
    result,
    callbacks
  );
  assert.equal(result.status_events.length, 1);
  // "error" must pass through untouched - the panel counts it as terminal.
  assert.deepEqual(seen.status[0], {
    engine: "web_search",
    state: "error",
    message: "⚠ unavailable",
  });
});

test("chunks accumulate into the message", () => {
  const { handler, result, seen, callbacks } = setup();
  handler._handleEvent({ type: "chunk", content: "Hello " }, result, callbacks);
  handler._handleEvent({ type: "chunk", content: "world" }, result, callbacks);
  assert.equal(result.message, "Hello world");
  assert.deepEqual(seen.chunks, ["Hello ", "world"]);
});

test("citations replace rather than append", () => {
  const { handler, result, callbacks } = setup();
  handler._handleEvent(
    { type: "citations", sources: [{ id: "a" }] },
    result,
    callbacks
  );
  handler._handleEvent(
    { type: "citations", sources: [{ id: "b" }] },
    result,
    callbacks
  );
  assert.deepEqual(result.citations, [{ id: "b" }]);
});

test("a citations event with no sources yields an empty list", () => {
  const { handler, result, callbacks } = setup();
  handler._handleEvent({ type: "citations" }, result, callbacks);
  assert.deepEqual(result.citations, []);
});

test("done captures elapsed time and the web-search outcome", () => {
  const { handler, result, callbacks } = setup();
  handler._handleEvent(
    {
      type: "done",
      elapsed_ms: 1234,
      web_search: {
        status: "not_configured",
        error: "WEB_SEARCH_API_KEY is not configured",
      },
    },
    result,
    callbacks
  );
  assert.equal(result.elapsed_ms, 1234);
  assert.equal(result.web_search.status, "not_configured");
});

test("done without a web-search block leaves it null", () => {
  const { handler, result, callbacks } = setup();
  handler._handleEvent({ type: "done", elapsed_ms: 10 }, result, callbacks);
  assert.equal(result.web_search, null);
  assert.equal(result.elapsed_ms, 10);
});

test("error events surface through onError", () => {
  const { handler, result, seen, callbacks } = setup();
  handler._handleEvent(
    { type: "error", message: "upstream boom" },
    result,
    callbacks
  );
  assert.deepEqual(result.errors, ["upstream boom"]);
  assert.equal(seen.errors[0].message, "upstream boom");
});

test("an unknown event type is ignored, not thrown", () => {
  const { handler, result, callbacks } = setup();
  assert.doesNotThrow(() =>
    handler._handleEvent({ type: "something-new" }, result, callbacks)
  );
  assert.equal(result.message, "");
});
