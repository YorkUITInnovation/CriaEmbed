/**
 * Low-cardinality in-process Prometheus text for /metrics scraping.
 * No student/IP/bot labels — route templates only.
 */

type RequestKey = string;

const BUCKETS = [0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, Infinity];

function requestKey(
  method: string,
  route: string,
  statusClass: string
): RequestKey {
  return `${method}|${route}|${statusClass}`;
}

class HttpMetricsStore {
  ready = 0;
  private requests = new Map<RequestKey, number>();
  private durationSum = new Map<RequestKey, number>();
  private durationCount = new Map<RequestKey, number>();
  private durationBucket = new Map<string, number>();

  setReady(ready: boolean): void {
    this.ready = ready ? 1 : 0;
  }

  observe(
    method: string,
    route: string,
    statusCode: number,
    durationS: number
  ): void {
    const statusClass = `${Math.floor(statusCode / 100)}xx`;
    const key = requestKey(method.toUpperCase(), route, statusClass);
    this.requests.set(key, (this.requests.get(key) || 0) + 1);
    this.durationSum.set(key, (this.durationSum.get(key) || 0) + durationS);
    this.durationCount.set(key, (this.durationCount.get(key) || 0) + 1);
    for (const bound of BUCKETS) {
      const le = bound === Infinity ? "+Inf" : String(bound);
      if (durationS <= bound) {
        const bKey = `${key}|${le}`;
        this.durationBucket.set(bKey, (this.durationBucket.get(bKey) || 0) + 1);
      }
    }
  }

  renderPrometheus(): string {
    const lines: string[] = [
      "# HELP cria_process_up Process is up.",
      "# TYPE cria_process_up gauge",
      'cria_process_up{service="criaembed"} 1',
      "# HELP cria_ready Last readiness probe outcome (1=ready).",
      "# TYPE cria_ready gauge",
      `cria_ready{service="criaembed"} ${this.ready}`,
      "# HELP cria_http_requests_total HTTP requests by route template.",
      "# TYPE cria_http_requests_total counter"
    ];

    for (const [key, count] of [...this.requests.entries()].sort()) {
      const [method, route, statusClass] = key.split("|");
      lines.push(
        `cria_http_requests_total{service="criaembed",method="${method}",` +
          `route="${route}",status_class="${statusClass}"} ${count}`
      );
    }

    lines.push(
      "# HELP cria_http_request_duration_seconds Time until response headers (TTFB).",
      "# TYPE cria_http_request_duration_seconds histogram"
    );
    for (const [bKey, count] of [...this.durationBucket.entries()].sort()) {
      const [method, route, statusClass, le] = bKey.split("|");
      lines.push(
        `cria_http_request_duration_seconds_bucket{service="criaembed",` +
          `method="${method}",route="${route}",status_class="${statusClass}",le="${le}"} ${count}`
      );
    }
    for (const [key, total] of [...this.durationSum.entries()].sort()) {
      const [method, route, statusClass] = key.split("|");
      const count = this.durationCount.get(key) || 0;
      const labels =
        `service="criaembed",method="${method}",route="${route}",` +
        `status_class="${statusClass}"`;
      lines.push(`cria_http_request_duration_seconds_sum{${labels}} ${total}`);
      lines.push(
        `cria_http_request_duration_seconds_count{${labels}} ${count}`
      );
    }
    lines.push("");
    return lines.join("\n");
  }
}

export const METRICS = new HttpMetricsStore();

const SKIP = new Set(["/metrics", "/livez", "/readyz", "/health_check"]);

/** Prefer Express route path template over raw URL (avoids botId cardinality). */
export function routeTemplate(req: {
  route?: { path?: string };
  baseUrl?: string;
  path?: string;
}): string {
  const routePath = req.route?.path;
  if (typeof routePath === "string" && routePath.length > 0) {
    const base = req.baseUrl || "";
    return `${base}${routePath}` || routePath;
  }
  return "unmatched";
}

export function metricsMiddleware(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction
): void {
  if (SKIP.has(req.path)) {
    next();
    return;
  }
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const elapsedNs = Number(process.hrtime.bigint() - started);
    METRICS.observe(
      req.method,
      routeTemplate(req),
      res.statusCode,
      elapsedNs / 1e9
    );
  });
  next();
}
