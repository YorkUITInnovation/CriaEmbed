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
    reply_html: null,
    format: null,
    received_done: false,
    received_error: false,
    outcome: "pending",
    partial_emitted: false,
    history_committed: null,
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

function sse(...payloads) {
  return payloads.map((p) => `data: ${JSON.stringify(p)}\n\n`).join("");
}

function mockFetchStream(chunks, { status = 200 } = {}) {
  const encoder = new TextEncoder();
  let index = 0;
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader() {
        return {
          async read() {
            if (index >= chunks.length) {
              return { done: true, value: undefined };
            }
            const value = encoder.encode(chunks[index++]);
            return { done: false, value };
          },
          releaseLock() {},
          async cancel() {},
        };
      },
    },
    async json() {
      return { message: "fail" };
    },
    async text() {
      return "fail";
    },
  });
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
  assert.equal(result.partial_emitted, true);
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

test("done captures elapsed time, reply_html, and the web-search outcome", () => {
  const { handler, result, callbacks } = setup();
  handler._handleEvent(
    {
      type: "done",
      elapsed_ms: 1234,
      reply_html: "<p>Hi</p>",
      web_search: {
        status: "not_configured",
        error: "WEB_SEARCH_API_KEY is not configured",
      },
    },
    result,
    callbacks
  );
  assert.equal(result.elapsed_ms, 1234);
  assert.equal(result.reply_html, "<p>Hi</p>");
  assert.equal(result.web_search.status, "not_configured");
  assert.equal(result.received_done, true);
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
  assert.equal(result.received_error, true);
});

test("an unknown event type is ignored, not thrown", () => {
  const { handler, result, callbacks } = setup();
  assert.doesNotThrow(() =>
    handler._handleEvent({ type: "something-new" }, result, callbacks)
  );
  assert.equal(result.message, "");
});

test("SSE parser reassembles events split across reads", () => {
  const { handler } = setup();
  const first = handler._consumeSseBuffer('data: {"type":"chun');
  assert.equal(first.events.length, 0);
  const second = handler._consumeSseBuffer(
    first.remainder + 'k","content":"Hi"}\n\ndata: {"type":"done","elapsed_ms":1}\n\n'
  );
  assert.equal(second.events.length, 2);
  assert.equal(second.events[0].type, "chunk");
  assert.equal(second.events[1].type, "done");
});

test("EOF without done is interrupted even with partial answer", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = mockFetchStream([
    sse({ type: "chunk", content: "partial answer", format: "markdown" }),
  ]);
  try {
    const handler = new StreamingChatHandler("bot", "chat", "http://api.test");
    const completes = [];
    const errors = [];
    const result = await handler.sendStream("hi", {
      onError: (e) => errors.push(e.message),
      onComplete: (r) => completes.push(r),
    });
    assert.equal(result.outcome, "interrupted");
    assert.equal(result.received_done, false);
    assert.equal(result.message, "partial answer");
    assert.match(errors[0], /terminal done/);
    assert.equal(completes.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("done then EOF is success", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = mockFetchStream([
    sse(
      { type: "chunk", content: "partial answer", format: "markdown" },
      {
        type: "done",
        elapsed_ms: 5,
        reply_html: "<p>partial answer</p>",
      }
    ),
  ]);
  try {
    const handler = new StreamingChatHandler("bot", "chat", "http://api.test");
    const result = await handler.sendStream("hi");
    assert.equal(result.outcome, "success");
    assert.equal(result.received_done, true);
    assert.equal(result.reply_html, "<p>partial answer</p>");
    assert.equal(result.errors.length, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

function mockFetchHangingAfter(chunks) {
  const encoder = new TextEncoder();
  let index = 0;
  const state = { cancelled: false };
  const fetchMock = async () => ({
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          async read() {
            if (index < chunks.length) {
              const value = encoder.encode(chunks[index++]);
              return { done: false, value };
            }
            // Connection stays open forever (no EOF).
            return new Promise(() => {});
          },
          releaseLock() {},
          async cancel() {
            state.cancelled = true;
          },
        };
      },
    },
    async json() {
      return { message: "fail" };
    },
    async text() {
      return "fail";
    },
  });
  return { fetchMock, state };
}

async function withTimeout(promise, ms = 500) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("sendStream did not settle")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

test("terminal error finalizes without waiting for EOF", async () => {
  const previousFetch = globalThis.fetch;
  const { fetchMock, state } = mockFetchHangingAfter([
    sse({ type: "error", message: "upstream boom" }),
  ]);
  globalThis.fetch = fetchMock;
  try {
    const handler = new StreamingChatHandler("bot", "chat", "http://api.test");
    const result = await withTimeout(handler.sendStream("hi"));
    assert.equal(result.outcome, "error");
    assert.equal(result.received_error, true);
    assert.equal(state.cancelled, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("done finalizes without waiting for EOF", async () => {
  const previousFetch = globalThis.fetch;
  const { fetchMock, state } = mockFetchHangingAfter([
    sse(
      { type: "chunk", content: "answer", format: "markdown" },
      { type: "done", elapsed_ms: 3, reply_html: "<p>answer</p>" }
    ),
  ]);
  globalThis.fetch = fetchMock;
  try {
    const handler = new StreamingChatHandler("bot", "chat", "http://api.test");
    const result = await withTimeout(handler.sendStream("hi"));
    assert.equal(result.outcome, "success");
    assert.equal(result.received_done, true);
    assert.equal(state.cancelled, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("done followed by error in one batch is a terminal violation", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = mockFetchStream([
    sse(
      { type: "done", elapsed_ms: 1 },
      { type: "error", message: "late error" }
    ),
  ]);
  try {
    const handler = new StreamingChatHandler("bot", "chat", "http://api.test");
    const result = await handler.sendStream("hi");
    assert.equal(result.outcome, "error");
    assert.match(result.errors.join(" "), /terminal sequence/i);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("error followed by done in one batch stays error", async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = mockFetchStream([
    sse(
      { type: "error", message: "boom" },
      { type: "done", elapsed_ms: 1 }
    ),
  ]);
  try {
    const handler = new StreamingChatHandler("bot", "chat", "http://api.test");
    const result = await handler.sendStream("hi");
    assert.equal(result.outcome, "error");
    assert.equal(result.received_done, false);
    assert.equal(result.received_error, true);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("duplicate done after error is ignored", () => {
  const { handler, result, callbacks } = setup();
  handler._handleEvent(
    { type: "error", message: "boom" },
    result,
    callbacks
  );
  const second = handler._handleEvent(
    { type: "done", elapsed_ms: 1 },
    result,
    callbacks
  );
  assert.equal(second, null);
  assert.equal(result.received_done, false);
  assert.equal(result.received_error, true);
});
