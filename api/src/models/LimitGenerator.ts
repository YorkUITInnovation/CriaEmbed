import rateLimit, {
  RateLimitExceededEventHandler,
  RateLimitRequestHandler,
  ValueDeterminingMiddleware,
  Options
} from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import RedisDefault from "ioredis";
import { CriaResponse } from "./CriaResponse.js";
import { Request, Response } from "express";
import { Config } from "../config.js";
import { rateLimitStorePrefix } from "./rateLimitPrefix.js";

export { rateLimitStorePrefix } from "./rateLimitPrefix.js";

function generateHandler(message?: string): RateLimitExceededEventHandler {
  function handler(_: Request, res: Response): void {
    const payload: CriaResponse = {
      timestamp: Date.now().toString(),
      status: 429,
      code: "TOO_MANY_REQUESTS",
      message: message || "You hit the rate limit for this"
    };

    res.status(429).json(payload);
  }

  return handler;
}

// Shared Redis counters across replicas; lazy client so import stays side-effect free.
// @ts-expect-error - ioredis default export is a constructor but TypeScript with Node16 module resolution doesn't recognize it
let limitRedisClient: InstanceType<typeof RedisDefault> | undefined;

function buildStore(prefix: string): Options["store"] | undefined {
  if (!Config.REDIS_HOST) return undefined;
  try {
    if (!limitRedisClient) {
      // @ts-expect-error - same ioredis constructor typing issue as redis.ts
      limitRedisClient = new RedisDefault({
        host: Config.REDIS_HOST,
        port: parseInt(Config.REDIS_PORT),
        username: Config.REDIS_USERNAME,
        password: Config.REDIS_PASSWORD,
        db: Config.RATE_LIMIT_REDIS_DB,
        lazyConnect: false,
        // Fail fast on Redis blips; rate limiting must degrade, not stall.
        commandTimeout: 1000,
        maxRetriesPerRequest: 1
      });
      limitRedisClient.on("error", (err: unknown) => {
        console.warn(
          "[RateLimit] Redis client error (passOnStoreError allows request):",
          err
        );
      });
    }
    const client = limitRedisClient;
    // Mocked/partial ioredis (unit tests) has no command interface - degrade.
    if (typeof (client as { call?: unknown }).call !== "function") {
      throw new Error("Redis command interface unavailable");
    }
    // express-rate-limit: one Store per limiter; client may be shared.
    return new RedisStore({
      prefix: `criaembed:rl:${prefix}:`,
      sendCommand: async (...args: string[]) => client.call(...args)
    });
  } catch (err) {
    console.warn("[RateLimit] Redis store unavailable; using in-memory:", err);
    return undefined;
  }
}

type KeyGeneratorSpec = {
  kind: string;
  generator: ValueDeterminingMiddleware<string>;
};

export default function LimitGenerator(
  options: Partial<Options>,
  keyGenerators: Array<KeyGeneratorSpec>,
  namespace: string
): RateLimitRequestHandler[] {
  const limiters: RateLimitRequestHandler[] = [];

  for (const { kind, generator } of keyGenerators) {
    const limiterOptions: Partial<Options> = {
      ...options,
      keyGenerator: generator,
      handler: generateHandler(options.message)
    };
    const limitValue =
      typeof options.limit === "number" || typeof options.limit === "string"
        ? options.limit
        : undefined;
    const store = buildStore(
      rateLimitStorePrefix(namespace, kind, options.windowMs, limitValue)
    );
    if (store) {
      limiterOptions.store = store;
      // Runtime Redis errors: fail open (allow request) — not in-memory switch.
      limiterOptions.passOnStoreError = true;
    }

    limiters.push(rateLimit(limiterOptions));
  }

  return limiters;
}

function getIP(req: Request): string {
  // Key on req.ip, never raw X-Forwarded-For: that header is client-controlled,
  // so keying on it lets an attacker rotate it to bypass the rate limiter.
  return req.ip || "unknown";
}

const KEY_GENERATORS: KeyGeneratorSpec[] = [
  {
    kind: "ip",
    generator: async (req: Request, _: Response): Promise<string> => getIP(req)
  },
  {
    kind: "host",
    // Express lowercases header names; "Host" is always undefined.
    generator: async (req: Request, _: Response): Promise<string> =>
      req.headers.host?.toString() || getIP(req)
  }
];

const RATE_LIMIT_CHAT_MINUTE_HANDLERS = LimitGenerator(
  { windowMs: 1000 * 60, limit: parseInt(Config.RATE_LIMIT_CHAT_MINUTE_MAX) },
  KEY_GENERATORS,
  "chat"
);

const RATE_LIMIT_CHAT_HOUR_HANDLERS = LimitGenerator(
  {
    windowMs: 1000 * 60 * 60,
    limit: parseInt(Config.RATE_LIMIT_CHAT_HOUR_MAX)
  },
  KEY_GENERATORS,
  "chat"
);

const RATE_LIMIT_CHAT_DAY_HANDLERS = LimitGenerator(
  {
    windowMs: 1000 * 60 * 60 * 24,
    limit: parseInt(Config.RATE_LIMIT_CHAT_DAY_MAX)
  },
  KEY_GENERATORS,
  "chat"
);

const RATE_LIMIT_EMBED_MINUTE_HANDLERS = LimitGenerator(
  { windowMs: 1000 * 60, limit: parseInt(Config.RATE_LIMIT_EMBED_MINUTE_MAX) },
  KEY_GENERATORS,
  "embed"
);

const RATE_LIMIT_EMBED_HOUR_HANDLERS = LimitGenerator(
  {
    windowMs: 1000 * 60 * 60,
    limit: parseInt(Config.RATE_LIMIT_EMBED_HOUR_MAX)
  },
  KEY_GENERATORS,
  "embed"
);

const RATE_LIMIT_EMBED_DAY_HANDLERS = LimitGenerator(
  {
    windowMs: 1000 * 60 * 60 * 24,
    limit: parseInt(Config.RATE_LIMIT_EMBED_DAY_MAX)
  },
  KEY_GENERATORS,
  "embed"
);

export const RATE_LIMIT_CHAT_ALL_HANDLERS = [
  ...RATE_LIMIT_CHAT_MINUTE_HANDLERS,
  ...RATE_LIMIT_CHAT_HOUR_HANDLERS,
  ...RATE_LIMIT_CHAT_DAY_HANDLERS
];

export const RATE_LIMIT_EMBED_ALL_HANDLERS = [
  ...RATE_LIMIT_EMBED_MINUTE_HANDLERS,
  ...RATE_LIMIT_EMBED_HOUR_HANDLERS,
  ...RATE_LIMIT_EMBED_DAY_HANDLERS
];
