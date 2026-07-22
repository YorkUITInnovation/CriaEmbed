export interface CostRate {
  promptPer1k: number;
  completionPer1k: number;
}

// Optional JSON map of {"<model>": {"promptPer1k": n, "completionPer1k": n}}.
// No pricing data is hardcoded here - without a configured rate, cost is 0
// rather than a guessed number.
function loadRates(): Record<string, CostRate> {
  const raw = process.env.CRIAEMBED_MODEL_COST_RATES;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const RATES = loadRates();

export function calculateCost(
  promptTokens: number | null | undefined,
  completionTokens: number | null | undefined,
  model: string = "default"
): number {
  const rate = RATES[model] || RATES["default"];
  if (!rate) return 0;

  const promptCost = ((promptTokens || 0) / 1000) * (rate.promptPer1k || 0);
  const completionCost =
    ((completionTokens || 0) / 1000) * (rate.completionPer1k || 0);

  return Math.round((promptCost + completionCost) * 1e6) / 1e6;
}
