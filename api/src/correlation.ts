import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import axios from "axios";

export const CORRELATION_HEADER = "x-correlation-id";
const MAX_LEN = 128;
const ALLOWED = /^[A-Za-z0-9._:-]+$/;

const storage = new AsyncLocalStorage<string>();

export function normalizeCorrelationId(raw: unknown): string {
  if (typeof raw === "string") {
    const value = raw.trim().slice(0, MAX_LEN);
    if (value && ALLOWED.test(value)) {
      return value;
    }
  }
  return `cria-${randomBytes(8).toString("hex")}`;
}

export function getCorrelationId(): string | undefined {
  return storage.getStore();
}

/** Express middleware: accept/mint id, echo on response, bind ALS for outbound axios. */
export function correlationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = normalizeCorrelationId(req.header(CORRELATION_HEADER));
  res.setHeader(CORRELATION_HEADER, correlationId);
  storage.run(correlationId, () => next());
}

/** Forward correlation on every axios call when an ALS id is present. */
export function installAxiosCorrelationInterceptor(): void {
  axios.interceptors.request.use(config => {
    const correlationId = getCorrelationId();
    if (correlationId) {
      config.headers = config.headers ?? {};
      const headers = config.headers as Record<string, unknown>;
      if (
        headers[CORRELATION_HEADER] == null &&
        headers["X-Correlation-Id"] == null
      ) {
        headers[CORRELATION_HEADER] = correlationId;
      }
    }
    return config;
  });
}
