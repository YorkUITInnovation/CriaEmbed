import assert from "node:assert/strict";
import test from "node:test";
import { observeViewport } from "../src/home/utils/viewport.js";

test("viewport follows keyboard/window resizing and removes its listeners", () => {
  const viewport = Object.assign(new EventTarget(), { height: 700 });
  const view = Object.assign(new EventTarget(), {
    visualViewport: viewport,
    innerHeight: 800,
  });
  const values = new Map();
  const element = {
    style: {
      setProperty: (key, value) => values.set(key, value),
      removeProperty: (key) => values.delete(key),
    },
  };
  const stop = observeViewport(view, element);
  assert.equal(values.get("--cria-app-height"), "700px");
  viewport.height = 300;
  viewport.dispatchEvent(new Event("resize"));
  assert.equal(values.get("--cria-app-height"), "300px");
  stop();
  viewport.dispatchEvent(new Event("resize"));
  view.dispatchEvent(new Event("resize"));
  assert.equal(values.size, 0);
});

test("viewport falls back to window sizing on older browsers", () => {
  const view = Object.assign(new EventTarget(), { innerHeight: 600 });
  let height;
  const stop = observeViewport(view, {
    style: {
      setProperty: (_key, value) => {
        height = value;
      },
      removeProperty: () => {},
    },
  });
  assert.equal(height, "600px");
  view.innerHeight = 240;
  view.dispatchEvent(new Event("resize"));
  assert.equal(height, "240px");
  stop();
});
