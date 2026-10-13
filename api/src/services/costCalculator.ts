export interface CostRate {
  promptPer1k: number;
  completionPer1k: number;
}

// Optional JSON map of {"<model>": {"promptPer1k": n, "completionPer1k": n}}.
// No pricing data is hardcoded here — without a configured rate, cost is null
// (unknown), never a silent zero that looks like "free".
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
): number | null {
  const rate = RATES[model] || RATES["default"];
  if (!rate) return null;

  const promptCost = ((promptTokens || 0) / 1000) * (rate.promptPer1k || 0);
  const completionCost =
    ((completionTokens || 0) / 1000) * (rate.completionPer1k || 0);

  return Math.round((promptCost + completionCost) * 1e6) / 1e6;
}

/** True when cost could not be priced (missing rates) — unknown ≠ free. */
export function isCostUnknown(cost: number | null | undefined): boolean {
  return cost === null || cost === undefined;
}
