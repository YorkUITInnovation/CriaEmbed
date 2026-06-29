import { getTheme } from "./ChatHeader.jsx";

export function getAccentColor() {
  const theme = window.Cria?.embedTheme || getTheme() || "#1065c7";
  return theme.startsWith("#") ? theme : `#${theme}`;
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

export function getStepKey(step, index) {
  return `${step.engine}-${step.state}-${step.timestamp || index}`;
}
