/**
 * Pure helpers for the agent reasoning trail.
 *
 * Kept free of React/window imports so the step-state rules - which decide
 * whether the thinking panel ever reports itself finished - can be tested
 * directly. agentChatTheme.js re-exports these for existing callers.
 */

/* A stage is over whether it succeeded or failed. Treating only "done" as
   terminal leaves a failed stage looking like it is still running forever. */
export const TERMINAL_STEP_STATES = ["done", "error"];

export function isTerminalStepState(state) {
  return TERMINAL_STEP_STATES.includes(state);
}

export function getLatestStep(steps = []) {
  if (!steps.length) return null;
  const pending = [...steps]
    .reverse()
    .find((s) => !isTerminalStepState(s.state));
  return pending || steps[steps.length - 1];
}

export function getActiveStep(steps = []) {
  return (
    [...steps].reverse().find((s) => !isTerminalStepState(s.state)) || null
  );
}

/**
 * The backend emits a paired start/terminal status per engine into one flat,
 * append-only list, so every stage otherwise renders twice and "all done" can
 * never be true. Collapse each engine into a single phase, keeping first-seen
 * order and letting the newest message win. The terminal state may be "error"
 * (e.g. web search with no provider configured), which still ends the stage.
 */
export function derivePhases(steps = []) {
  const order = [];
  const byEngine = new Map();

  steps.forEach((step, index) => {
    const engine = step?.engine || `step-${index}`;

    if (!byEngine.has(engine)) {
      order.push(engine);
      byEngine.set(engine, { engine, message: "", state: "start" });
    }

    const phase = byEngine.get(engine);
    if (isTerminalStepState(step?.state)) {
      phase.state = step.state;
    }
    if (step?.message) {
      phase.message = step.message;
    }
  });

  return order.map((engine) => byEngine.get(engine));
}

/** Keep backend emoji labels; only trim redundant leading checkmarks for done rows. */
export function formatStepMessage(step) {
  const message = (step?.message || "").trim();
  if (!message) return "";

  if (step.state === "done") {
    return message.startsWith("✓") ? message : `✓ ${message}`;
  }

  return message;
}

/**
 * Progress of the reasoning trail. `finished` counts failed stages too, so the
 * panel settles instead of sitting on "Processing" when a stage errors.
 */
export function summarizePhases(phases = []) {
  const finished = phases.filter((p) => isTerminalStepState(p.state)).length;
  const failed = phases.filter((p) => p.state === "error").length;
  const allDone = phases.length > 0 && finished === phases.length;

  return {
    total: phases.length,
    finished,
    failed,
    allDone,
    allSucceeded: allDone && failed === 0,
    percent: phases.length ? Math.round((finished / phases.length) * 100) : 0,
  };
}

export function formatElapsed(ms) {
  if (ms == null || Number.isNaN(ms)) return null;
  const seconds = ms / 1000;
  if (seconds < 1) return "<1s";
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}

export function buildThinkingSummary({
  steps = [],
  elapsedMs = null,
  sourceCount = 0,
}) {
  const elapsed = formatElapsed(elapsedMs);
  const parts = [];

  if (elapsed) {
    parts.push(`Processed in ${elapsed}`);
  } else if (steps.length > 0) {
    parts.push("Processing complete");
  }

  if (sourceCount > 0) {
    parts.push(`${sourceCount} source${sourceCount === 1 ? "" : "s"}`);
  }

  return parts.join(" · ") || "View details";
}
