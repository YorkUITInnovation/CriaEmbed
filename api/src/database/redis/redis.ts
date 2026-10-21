import RedisDefault from "ioredis";
import { Config } from "../../config.js";

// @ts-expect-error - ioredis default export is a constructor but TypeScript with Node16 module resolution doesn't recognize it
export const REDIS_POOL: InstanceType<typeof RedisDefault> = new RedisDefault({
  port: parseInt(Config.REDIS_PORT),
  host: Config.REDIS_HOST,
  username: Config.REDIS_USERNAME,
  password: Config.REDIS_PASSWORD,
  db: Config.REDIS_DB,
  connectTimeout: 40_000,
  commandTimeout: 40_000,
  // Fail fast on transient Redis errors; pool reconnects in background.
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false
});

// Without a listener, ioredis 'error' events crash the process.
REDIS_POOL.on("error", (err: unknown) => {
  console.warn("[Redis] Pool client error (will retry in background):", err);
});

export async function closeRedisPool(): Promise<void> {
  if (!REDIS_POOL) {
    return;
  }

  // Best-effort: quit() on a non-ready client waits out commandTimeout.
  try {
    const status = (REDIS_POOL as { status?: string }).status;
    if (status && status !== "ready") {
      REDIS_POOL.disconnect();
      return;
    }
    await REDIS_POOL.quit();
  } catch {
    try {
      REDIS_POOL.disconnect();
    } catch {
      /* already disconnected */
    }
  }
}
