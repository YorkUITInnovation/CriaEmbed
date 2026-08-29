import { getTheme } from "./ChatHeader.jsx";

/* Step-state helpers live in chatSteps.js (no React/window imports, so they are
   directly testable); re-exported here so existing importers are unaffected. */
export {
  TERMINAL_STEP_STATES,
  isTerminalStepState,
  getLatestStep,
  getActiveStep,
  derivePhases,
  formatStepMessage,
  summarizePhases,
  formatElapsed,
  buildThinkingSummary,
} from "./chatSteps.js";

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
