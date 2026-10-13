import { rateLimitStorePrefix } from "../../src/models/rateLimitPrefix";

describe("rateLimitStorePrefix", () => {
  it("includes category, key-kind, window, and limit so chat/embed never collide", () => {
    const chatIp = rateLimitStorePrefix("chat", "ip", 60000, 60);
    const embedIp = rateLimitStorePrefix("embed", "ip", 60000, 60);
    const chatHost = rateLimitStorePrefix("chat", "host", 60000, 60);

    expect(chatIp).toBe("chat:ip:60000-60");
    expect(embedIp).toBe("embed:ip:60000-60");
    expect(chatHost).toBe("chat:host:60000-60");
    expect(chatIp).not.toBe(embedIp);
    expect(chatIp).not.toBe(chatHost);
  });

  it("keeps equal numeric limits in different namespaces isolated", () => {
    // Jest/prod often use the same minute/hour/day numbers for chat and embed.
    expect(rateLimitStorePrefix("chat", "ip", 3_600_000, 600)).not.toBe(
      rateLimitStorePrefix("embed", "ip", 3_600_000, 600)
    );
  });
});
