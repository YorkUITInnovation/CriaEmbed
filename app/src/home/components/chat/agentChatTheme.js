import { getTheme } from "./ChatHeader.jsx";

export function getAccentColor() {
  const theme = window.Cria?.embedTheme || getTheme() || "#1065c7";
  return theme.startsWith("#") ? theme : `#${theme}`;
}

/** Accent colour at a given alpha. Falls back to neutral grey when the theme
 *  isn't a plain 6-digit hex, so a bad value never produces invalid CSS. */
export function withAlpha(color, alpha) {
  const hex = typeof color === "string" ? color.replace("#", "") : "";
  const clamped = Math.max(0, Math.min(1, alpha));

  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return `rgba(107, 114, 128, ${clamped})`;
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}

export function formatElapsed(ms) {
  if (ms == null || Number.isNaN(ms)) return null;
  const seconds = ms / 1000;
  if (seconds < 1) return "<1s";
  if (seconds < 10) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds)}s`;
}

export function getLatestStep(steps = []) {
  if (!steps.length) return null;
  const pending = [...steps].reverse().find((s) => s.state !== "done");
  return pending || steps[steps.length - 1];
}

export function getActiveStep(steps = []) {
  return [...steps].reverse().find((s) => s.state !== "done") || null;
}

/**
 * The backend emits a paired start/done status per engine into one flat,
 * append-only list, so every stage otherwise renders twice and "all done" can
 * never be true. Collapse each engine into a single phase, keeping first-seen
 * order and letting the newest message win (so a finished phase shows its
 * completion text).
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
    if (step?.state === "done") {
      phase.state = "done";
    }
    if (step?.message) {
      phase.message = step.message;
    }
  });

  return order.map((engine) => byEngine.get(engine));
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

/** Keep backend emoji labels; only trim redundant leading checkmarks for done rows. */
export function formatStepMessage(step) {
  const message = (step?.message || "").trim();
  if (!message) return "";

  if (step.state === "done") {
    return message.startsWith("✓") ? message : `✓ ${message}`;
  }

  return message;
}
