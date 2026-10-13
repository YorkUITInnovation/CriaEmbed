import {
  METRICS,
  routeTemplate,
  metricsMiddleware
} from "../../src/httpMetrics";

describe("httpMetrics", () => {
  it("renders ready and HTTP samples in prometheus text", () => {
    METRICS.setReady(true);
    METRICS.observe("GET", "/embed/{botId}/config", 200, 0.02);
    const text = METRICS.renderPrometheus();
    expect(text).toContain('cria_process_up{service="criaembed"} 1');
    expect(text).toContain('cria_ready{service="criaembed"} 1');
    expect(text).toContain("cria_http_requests_total");
    expect(text).toContain('route="/embed/{botId}/config"');
  });

  it("uses Express route path template when available", () => {
    expect(
      routeTemplate({
        baseUrl: "/embed",
        route: { path: "/:botId/config" },
        path: "/embed/bot-123/config"
      })
    ).toBe("/embed/:botId/config");
  });

  it("metricsMiddleware observes finished responses", done => {
    const req = {
      path: "/embed/x/config",
      method: "GET",
      baseUrl: "/embed",
      route: { path: "/:botId/config" }
    } as any;
    const listeners: Record<string, Function[]> = {};
    const res = {
      statusCode: 200,
      on(event: string, cb: Function) {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      }
    } as any;

    metricsMiddleware(req, res, () => {
      const before = METRICS.renderPrometheus();
      for (const cb of listeners.finish || []) cb();
      const after = METRICS.renderPrometheus();
      expect(after.length).toBeGreaterThan(before.length);
      expect(after).toContain("cria_http_requests_total");
      done();
    });
  });
});
