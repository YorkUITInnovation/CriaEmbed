import test from "node:test";
import assert from "node:assert/strict";

import {
  derivePhases,
  formatStepMessage,
  getActiveStep,
  getLatestStep,
  isTerminalStepState,
  buildThinkingSummary,
  formatElapsed,
  summarizePhases,
} from "../src/home/components/chat/chatSteps.js";

/* The exact status sequence Criabot streams when web search has no provider
   key configured. This shape is the regression these tests exist for. */
const WEB_SEARCH_FAILED = [
  { engine: "graph_rag", state: "start", message: "🔍 Searching..." },
  { engine: "graph_rag", state: "done", message: "✓ Found 4 chunks" },
  {
    engine: "web_search",
    state: "start",
    message: "🌐 Dispatching secure web query...",
  },
  {
    engine: "web_search",
    state: "error",
    message: "⚠ Web search unavailable (search provider is not configured)",
  },
  { engine: "rerank", state: "start", message: "⚡ Reranking sources..." },
  {
    engine: "rerank",
    state: "done",
    message: "✓ Rerank complete: top 3 sources selected",
  },
];

const ALL_SUCCEEDED = WEB_SEARCH_FAILED.map((step) =>
  step.state === "error"
    ? {
        ...step,
        state: "done",
        message: "✓ Web search retrieved 3 external resources",
      }
    : step
);

test("isTerminalStepState treats error as terminal, start as not", () => {
  assert.equal(isTerminalStepState("done"), true);
  assert.equal(isTerminalStepState("error"), true);
  assert.equal(isTerminalStepState("start"), false);
  assert.equal(isTerminalStepState(undefined), false);
});

test("derivePhases collapses each engine to one row in first-seen order", () => {
  const phases = derivePhases(WEB_SEARCH_FAILED);
  assert.deepEqual(
    phases.map((p) => p.engine),
    ["graph_rag", "web_search", "rerank"]
  );
});

test("derivePhases lets a failed stage leave the start state", () => {
  // Regression: only `state === "done"` promoted a phase, so an errored stage
  // stayed "start" forever and the panel never reported itself finished.
  const phases = derivePhases(WEB_SEARCH_FAILED);
  assert.equal(phases.find((p) => p.engine === "web_search").state, "error");
});

test("derivePhases keeps the newest message for each stage", () => {
  const phases = derivePhases(WEB_SEARCH_FAILED);
  assert.match(
    phases.find((p) => p.engine === "web_search").message,
    /Web search unavailable/
  );
});

test("summarizePhases counts a failed stage as finished", () => {
  const summary = summarizePhases(derivePhases(WEB_SEARCH_FAILED));
  assert.deepEqual(summary, {
    total: 3,
    finished: 3,
    failed: 1,
    allDone: true,
    allSucceeded: false,
    percent: 100,
  });
});

test("summarizePhases reports full success when nothing failed", () => {
  const summary = summarizePhases(derivePhases(ALL_SUCCEEDED));
  assert.equal(summary.allDone, true);
  assert.equal(summary.allSucceeded, true);
  assert.equal(summary.failed, 0);
  assert.equal(summary.percent, 100);
});

test("summarizePhases leaves an in-flight run incomplete", () => {
  const summary = summarizePhases(derivePhases(WEB_SEARCH_FAILED.slice(0, 3)));
  assert.equal(summary.allDone, false);
  assert.equal(summary.finished, 1);
  assert.equal(summary.percent, 50);
});

test("summarizePhases handles an empty trail without dividing by zero", () => {
  assert.deepEqual(summarizePhases([]), {
    total: 0,
    finished: 0,
    failed: 0,
    allDone: false,
    allSucceeded: false,
    percent: 0,
  });
});

test("a failed stage is not treated as the currently-running one", () => {
  // lastIndexOf("start") drives which row renders as active; an errored stage
  // must not claim that slot after the stream has moved on.
  const phases = derivePhases(WEB_SEARCH_FAILED);
  assert.equal(phases.map((p) => p.state).lastIndexOf("start"), -1);
});

test("getActiveStep / getLatestStep treat an errored step as settled", () => {
  // These read the raw append-only list (every engine also has a "start" entry),
  // so use a terminal-only list to isolate the error-vs-done distinction.
  const settled = [
    { engine: "graph_rag", state: "done", message: "✓ Found 4 chunks" },
    {
      engine: "web_search",
      state: "error",
      message: "⚠ Web search unavailable",
    },
  ];
  // Previously the errored step counted as still-active and was returned here.
  assert.equal(getActiveStep(settled), null);
  assert.equal(getLatestStep(settled).engine, "web_search");

  const running = [
    ...settled,
    { engine: "rerank", state: "start", message: "⚡ Reranking..." },
  ];
  assert.equal(getActiveStep(running).engine, "rerank");
});

test("formatStepMessage prefixes a check only for done rows", () => {
  assert.equal(
    formatStepMessage({ state: "done", message: "Found 4 chunks" }),
    "✓ Found 4 chunks"
  );
  assert.equal(
    formatStepMessage({ state: "done", message: "✓ Already checked" }),
    "✓ Already checked"
  );
  // The backend's own ⚠ must survive untouched - no ✓ on a failure.
  assert.equal(
    formatStepMessage({ state: "error", message: "⚠ Web search unavailable" }),
    "⚠ Web search unavailable"
  );
  assert.equal(formatStepMessage({ state: "start", message: "" }), "");
});

test("formatElapsed renders sub-second, seconds and rounded values", () => {
  assert.equal(formatElapsed(400), "<1s");
  assert.equal(formatElapsed(1500), "1.5s");
  assert.equal(formatElapsed(19400), "19s");
  assert.equal(formatElapsed(null), null);
  assert.equal(formatElapsed(undefined), null);
  assert.equal(formatElapsed(NaN), null);
});

test("buildThinkingSummary pluralizes and degrades gracefully", () => {
  assert.equal(
    buildThinkingSummary({ steps: [{}], elapsedMs: 19000, sourceCount: 5 }),
    "Processed in 19s · 5 sources"
  );
  assert.equal(
    buildThinkingSummary({ steps: [{}], elapsedMs: 1200, sourceCount: 1 }),
    "Processed in 1.2s · 1 source"
  );
  // No timing yet, but steps exist.
  assert.equal(buildThinkingSummary({ steps: [{}] }), "Processing complete");
  // Nothing at all.
  assert.equal(buildThinkingSummary({}), "View details");
});
