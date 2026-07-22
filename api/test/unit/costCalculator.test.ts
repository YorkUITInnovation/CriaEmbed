describe("costCalculator", () => {
  const ORIGINAL_ENV = process.env.CRIAEMBED_MODEL_COST_RATES;

  afterEach(() => {
    process.env.CRIAEMBED_MODEL_COST_RATES = ORIGINAL_ENV;
    jest.resetModules();
  });

  it("returns 0 when no rate table is configured", async () => {
    delete process.env.CRIAEMBED_MODEL_COST_RATES;
    jest.resetModules();
    const { calculateCost } = await import("../../src/services/costCalculator");

    expect(calculateCost(1000, 1000)).toBe(0);
  });

  it("returns 0 when the JSON rate table is malformed", async () => {
    process.env.CRIAEMBED_MODEL_COST_RATES = "not json";
    jest.resetModules();
    const { calculateCost } = await import("../../src/services/costCalculator");

    expect(calculateCost(1000, 1000)).toBe(0);
  });

  it("computes cost from configured per-1k rates for the default model", async () => {
    process.env.CRIAEMBED_MODEL_COST_RATES = JSON.stringify({
      default: { promptPer1k: 0.01, completionPer1k: 0.02 }
    });
    jest.resetModules();
    const { calculateCost } = await import("../../src/services/costCalculator");

    // 1000 prompt tokens * 0.01/1k + 500 completion tokens * 0.02/1k
    expect(calculateCost(1000, 500)).toBeCloseTo(0.01 + 0.01, 6);
  });

  it("uses a model-specific rate when configured", async () => {
    process.env.CRIAEMBED_MODEL_COST_RATES = JSON.stringify({
      "gpt-4": { promptPer1k: 0.03, completionPer1k: 0.06 },
      default: { promptPer1k: 0.001, completionPer1k: 0.001 }
    });
    jest.resetModules();
    const { calculateCost } = await import("../../src/services/costCalculator");

    expect(calculateCost(1000, 0, "gpt-4")).toBeCloseTo(0.03, 6);
  });

  it("treats null/undefined token counts as 0", async () => {
    process.env.CRIAEMBED_MODEL_COST_RATES = JSON.stringify({
      default: { promptPer1k: 0.01, completionPer1k: 0.02 }
    });
    jest.resetModules();
    const { calculateCost } = await import("../../src/services/costCalculator");

    expect(calculateCost(null, undefined)).toBe(0);
  });
});
