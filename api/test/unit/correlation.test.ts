import {
  CORRELATION_HEADER,
  getCorrelationId,
  normalizeCorrelationId,
  correlationMiddleware
} from "../../src/correlation";

describe("correlation", () => {
  it("normalizes safe ids and rejects junk", () => {
    expect(normalizeCorrelationId("abc-123_OK:1")).toBe("abc-123_OK:1");
    expect(normalizeCorrelationId("bad value!")).toMatch(/^cria-/);
    expect(normalizeCorrelationId(undefined)).toMatch(/^cria-/);
  });

  it("middleware echoes inbound id and binds ALS", () => {
    const req = {
      header: (name: string) =>
        name.toLowerCase() === CORRELATION_HEADER ? "client-corr-1" : undefined
    };
    const headers: Record<string, string> = {};
    const res = {
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      }
    };
    let seen: string | undefined;
    correlationMiddleware(req as any, res as any, () => {
      seen = getCorrelationId();
    });
    expect(headers[CORRELATION_HEADER]).toBe("client-corr-1");
    expect(seen).toBe("client-corr-1");
  });
});
