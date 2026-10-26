import assert from "node:assert/strict";
import test from "node:test";
import {
  readAutoScrollTop,
  readShowSources,
  shouldAutoAnchorToResponseTop,
  shouldRenderSources,
} from "../src/home/utils/showSources.js";

test("config flags default to on when the API omits them", () => {
  const config = {}; // Older API response without the flags.
  assert.equal(readShowSources(config), true);
  assert.equal(readAutoScrollTop(config), true);
  assert.equal(readShowSources(undefined), true);
  assert.equal(readAutoScrollTop(undefined), true);
});

test("config flags respect explicit true and false values", () => {
  assert.equal(readShowSources({ showSources: true }), true);
  assert.equal(readShowSources({ showSources: false }), false);
  assert.equal(readAutoScrollTop({ autoScrollTop: true }), true);
  assert.equal(readAutoScrollTop({ autoScrollTop: false }), false);
});

test("the two config flags read independently", () => {
  const config = { showSources: false, autoScrollTop: true };
  assert.equal(readShowSources(config), false);
  assert.equal(readAutoScrollTop(config), true);

  const flipped = { showSources: true, autoScrollTop: false };
  assert.equal(readShowSources(flipped), true);
  assert.equal(readAutoScrollTop(flipped), false);
});

test("config flags feed the render gate from the embed config", () => {
  const citations = [{ title: "Doc" }];
  const config = { showSources: false };
  assert.equal(shouldRenderSources(readShowSources(config), citations), false);
  assert.equal(
    shouldRenderSources(readShowSources({ showSources: true }), citations),
    true
  );
  assert.equal(shouldRenderSources(readShowSources({}), citations), true);
});

test("sources render only when the flag is on and citations exist", () => {
  const citations = [{ title: "Doc" }];
  assert.equal(shouldRenderSources(true, citations), true);
  // Flag off hides the citation block entirely.
  assert.equal(shouldRenderSources(false, citations), false);
  // Undefined flag keeps the default-on behavior.
  assert.equal(shouldRenderSources(undefined, citations), true);
  assert.equal(shouldRenderSources(true, []), false);
  assert.equal(shouldRenderSources(true, undefined), false);
});

test("auto-anchor fires on completion only when auto-scroll is on", () => {
  const base = {
    autoScrollTop: true,
    streamingFinished: true,
    addedBotReply: true,
    userScrolledAway: false,
  };
  assert.equal(shouldAutoAnchorToResponseTop(base), true);
  // Setting off: no auto-anchor (chip-only path stays).
  assert.equal(
    shouldAutoAnchorToResponseTop({ ...base, autoScrollTop: false }),
    false
  );
  // Undefined flag keeps the default-on behavior.
  assert.equal(
    shouldAutoAnchorToResponseTop({ ...base, autoScrollTop: undefined }),
    true
  );
});

test("auto-anchor reads the config flag and ignores sources entirely", () => {
  const base = {
    streamingFinished: true,
    addedBotReply: true,
    userScrolledAway: false,
  };
  const sourcesHidden = { showSources: false, autoScrollTop: true };
  const scrollDisabled = { showSources: true, autoScrollTop: false };
  // Sources hidden must not suppress the response-top anchor.
  assert.equal(
    shouldAutoAnchorToResponseTop({
      ...base,
      autoScrollTop: readAutoScrollTop(sourcesHidden),
    }),
    true
  );
  // Sources shown must not force an anchor when auto-scroll is off.
  assert.equal(
    shouldAutoAnchorToResponseTop({
      ...base,
      autoScrollTop: readAutoScrollTop(scrollDisabled),
    }),
    false
  );
});

test("auto-anchor is suppressed when the user scrolled during streaming", () => {
  assert.equal(
    shouldAutoAnchorToResponseTop({
      autoScrollTop: true,
      streamingFinished: true,
      addedBotReply: true,
      userScrolledAway: true,
    }),
    false
  );
});

test("auto-anchor requires a finished stream that added a bot reply", () => {
  const base = { autoScrollTop: true, userScrolledAway: false };
  assert.equal(
    shouldAutoAnchorToResponseTop({
      ...base,
      streamingFinished: false,
      addedBotReply: true,
    }),
    false
  );
  assert.equal(
    shouldAutoAnchorToResponseTop({
      ...base,
      streamingFinished: true,
      addedBotReply: false,
    }),
    false
  );
});
