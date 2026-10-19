import { Config, chatBudget } from "../../src/config";

describe("chat timeout budget", () => {
  it("preserves a numeric default and parses explicit budgets", () => {
    expect(chatBudget(undefined)).toBe(90000);
    expect(chatBudget("120000")).toBe(120000);
    expect(typeof Config.CRIA_BOT_CHAT_TIMEOUT_MS).toBe("number");
  });

  it.each(["", "0", "-1", "1.5", "NaN", "Infinity", "2147483648"])(
    "rejects unsupported timer budget %s explicitly",
    value => expect(() => chatBudget(value)).toThrow("CRIA_BOT_CHAT_TIMEOUT_MS")
  );
});
