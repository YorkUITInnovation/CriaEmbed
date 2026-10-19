import assert from "node:assert/strict";
import test from "node:test";
import { chatTimeoutMs } from "../src/home/utils/chatTimeout.js";

test("loading timeout follows API configuration and supports older APIs", () => {
  assert.equal(chatTimeoutMs({ chatTimeoutMs: 120000 }), 120000);
  assert.equal(chatTimeoutMs({}), 90000);
  assert.equal(chatTimeoutMs(undefined), 90000);
});

test("invalid loading budgets fail explicitly instead of creating immediate timers", () => {
  for (const value of [null, "90000", -1, 0, NaN, Infinity, 1.5, 2147483648]) {
    assert.throws(
      () => chatTimeoutMs({ chatTimeoutMs: value }),
      /Invalid embed/
    );
  }
});
