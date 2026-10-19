import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import vm from "node:vm";

const popup = await fs.readFile(
  new URL("../../api/src/assets/public/popup/embed.js", import.meta.url),
  "utf8"
);
const inline = await fs.readFile(
  new URL("../../api/src/assets/public/inline/embed.js", import.meta.url),
  "utf8"
);

function element(classes = []) {
  const attrs = new Map([["botId", "bot"]]);
  const properties = new Map();
  const names = new Set(classes);
  return {
    style: {
      setProperty: (key, value) => properties.set(key, value),
      getPropertyValue: (key) => properties.get(key),
    },
    classList: {
      add: (...values) => values.forEach((value) => names.add(value)),
      remove: (...values) => values.forEach((value) => names.delete(value)),
      contains: (value) => names.has(value),
    },
    className: classes.join(" "),
    clientWidth: 350,
    clientHeight: 550,
    setAttribute: (key, value) => attrs.set(key, value),
    getAttribute: (key) => attrs.get(key),
    appendChild: () => {},
    setPointerCapture: () => {},
    hasPointerCapture: () => true,
    releasePointerCapture: () => {},
  };
}

async function loadPopup() {
  const nodes = Object.fromEntries(
    ["wrapper", "chat", "launcher", "embed", "bot-icon", "chat-overlay"].map(
      (name) => [name, element([`cria-${name}`])]
    )
  );
  nodes.embed.contentWindow = {};
  const listeners = {};
  const viewportListeners = {};
  const body = element();
  let otherOpen = false;
  const config = {
    webAppUrl: "https://embed.test",
    chatApiUrl: "https://api.test",
    defaultEnabled: true,
    botId: "bot",
    chatId: "chat",
  };
  const window = {
    CRIA: { bot: config },
    innerWidth: 900,
    innerHeight: 700,
    matchMedia: () => ({ matches: false }),
    visualViewport: {
      height: 700,
      width: 900,
      offsetTop: 0,
      offsetLeft: 0,
      addEventListener: (name, callback) => {
        viewportListeners[name] = callback;
      },
    },
    addEventListener: (name, callback) => {
      listeners[name] = callback;
    },
  };
  const document = {
    body,
    createElement: () => element(),
    getElementById: () => null,
    addEventListener: (name, callback) => {
      listeners[name] = callback;
    },
    querySelector: (selector) => {
      if (selector === '.cria-wrapper[enabled="true"]') {
        return otherOpen || nodes.wrapper.getAttribute("enabled") === "true"
          ? nodes.wrapper
          : null;
      }
      const name = selector.match(/^\.cria-([\w-]+)/)?.[1];
      return nodes[name] ?? null;
    },
  };
  vm.runInNewContext(
    popup.replace("$botIdLiteral", '"bot"').replace("$hideLauncher", "false"),
    {
      window,
      document,
      URL,
      fetch: async () => ({ text: async () => "" }),
      console: { info: () => {} },
    }
  );
  await new Promise((resolve) => setImmediate(resolve));
  return {
    nodes,
    config,
    body,
    window,
    listeners,
    viewportListeners,
    setOtherOpen: (value) => {
      otherOpen = value;
    },
  };
}

test("popup fits visual viewport after keyboard changes and tracks launcher state", async () => {
  const { nodes, window, viewportListeners, config } = await loadPopup();
  assert.equal(
    nodes.wrapper.style.getPropertyValue("--cria-viewport-height"),
    "700px"
  );
  window.visualViewport.height = 280;
  window.visualViewport.offsetTop = 20;
  viewportListeners.resize();
  assert.equal(
    nodes.wrapper.style.getPropertyValue("--cria-viewport-height"),
    "280px"
  );
  assert.equal(
    nodes.wrapper.style.getPropertyValue("--cria-viewport-top"),
    "20px"
  );
  config.setEmbedEnabled(false);
  assert.equal(nodes.launcher.getAttribute("aria-expanded"), "false");
});

test("closing one popup keeps scroll lock while another popup remains open", async () => {
  const { body, config, setOtherOpen } = await loadPopup();
  setOtherOpen(true);
  config.setEmbedEnabled(false);
  assert.equal(body.getAttribute("cria-enabled"), "true");
  setOtherOpen(false);
  config.setEmbedEnabled(false);
  assert.equal(body.getAttribute("cria-enabled"), "false");
});

test("close messages only affect their own iframe and expected origin", async () => {
  const { config, nodes, listeners } = await loadPopup();
  const message = {
    data: JSON.stringify({ action: "criaSetEmbedEnabled", value: false }),
    origin: "https://embed.test",
    source: nodes.embed.contentWindow,
  };
  listeners.message({ ...message, source: {} });
  assert.equal(config.isEmbedEnabled(), true);
  listeners.message({ ...message, origin: "https://other.test" });
  assert.equal(config.isEmbedEnabled(), true);
  listeners.message(message);
  assert.equal(config.isEmbedEnabled(), false);
});

test("pointer resizing clamps dimensions and cancellation releases the overlay", async () => {
  const { nodes, listeners } = await loadPopup();
  const target = element(["cria-chat-n"]);
  const event = {
    target,
    pointerId: 7,
    button: 0,
    buttons: 1,
    clientX: 0,
    clientY: 100,
    preventDefault: () => {},
  };
  listeners.pointerdown(event);
  assert.equal(nodes["chat-overlay"].style.pointerEvents, "all");
  listeners.pointermove({ ...event, clientY: -2000 });
  assert.equal(nodes.embed.style.height, "560px");
  listeners.pointercancel(event);
  assert.equal(nodes["chat-overlay"].style.pointerEvents, "none");
});

test("inline iframe retains default dimensions but fits its container", async () => {
  let iframe;
  const anchor = element();
  anchor.appendChild = (child) => {
    iframe = child;
  };
  vm.runInNewContext(inline.replace("$botIdLiteral", '"bot"'), {
    window: {
      CRIA: { bot: { webAppUrl: "https://embed.test", botId: "bot" } },
    },
    document: {
      createElement: () => element(),
      querySelector: () => anchor,
      getElementById: () => null,
    },
    URL,
    console: { info: () => {} },
  });
  assert.equal(iframe.getAttribute("width"), "350");
  assert.equal(iframe.getAttribute("height"), "600");
  assert.equal(iframe.style.maxWidth, "100%");
  assert.equal(iframe.style.maxHeight, "100dvh");
  assert.equal(iframe.title, "Chat assistant");
});
