import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";
import { transform } from "esbuild";

const source = await fs.readFile(
  new URL("../src/home/components/query/QueryBox.jsx", import.meta.url),
  "utf8"
);
const { code } = await transform(source, { loader: "jsx", format: "cjs" });

function setup(sendStream) {
  const events = [];
  const exports = {};
  const module = { exports };
  class Component {
    setState(state) {
      Object.assign(this.state, state);
    }
  }
  class Handler {
    async sendStream(content, callbacks) {
      return sendStream(content, callbacks);
    }
  }
  vm.runInNewContext(code, {
    module,
    exports,
    require: (name) => {
      if (name === "react") return { Component };
      if (name === "styled-components")
        return { styled: { div: () => "div", span: () => "span" } };
      if (name.endsWith("StreamingChatHandler.js")) return Handler;
      return {};
    },
    window: {
      Cria: { botId: "bot", chatId: "chat", chatApiUrl: "http://api.test" },
    },
    document: { dispatchEvent: (event) => events.push(event) },
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    console: { error: () => {} },
  });
  return { QueryBox: module.exports.default, events };
}

test("empty streams report an error without dispatching a second chat POST", async () => {
  const { QueryBox, events } = setup(async (_content, callbacks) => {
    const result = { message: "", errors: [] };
    callbacks.onComplete(result);
    return result;
  });
  const box = new QueryBox();
  box.sendChatRegular = () =>
    assert.fail("Must not replay a non-idempotent POST");
  await box.sendChatStreaming("hello");
  assert.equal(events.at(-1).type, "chatStreamError");
  assert.match(events.at(-1).detail.message, /without an answer/);
});

test("unexpected stream failure reports an error without a blocking fallback", async () => {
  const { QueryBox, events } = setup(async () => {
    throw new Error("Connection lost");
  });
  const box = new QueryBox();
  box.sendChatRegular = () =>
    assert.fail("Must not replay a non-idempotent POST");
  await box.sendChatStreaming("hello");
  assert.equal(events.at(-1).type, "chatStreamError");
  assert.equal(events.at(-1).detail.message, "Connection lost");
});

test("successful streams preserve the reply and completion events", async () => {
  const { QueryBox, events } = setup(async (_content, callbacks) => {
    const result = {
      message: "Hello",
      errors: [],
      citations: [],
      elapsed_ms: 12,
    };
    callbacks.onComplete(result);
    return result;
  });
  await new QueryBox().sendChatStreaming("hello");
  assert.deepEqual(
    events.map((event) => event.type),
    ["chatReply", "chatStreamComplete"]
  );
  assert.equal(events[0].detail.reply, "Hello");
});
