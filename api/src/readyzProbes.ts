import { getMySQLPool } from "./database/mysql/pool.js";
import { REDIS_POOL } from "./database/redis/redis.js";

export const READY_PROBE_MS = 2000;

/** Bound MySQL check; destroy the connection on timeout so work does not accumulate. */
export async function probeMysqlReady(
  timeoutMs: number = READY_PROBE_MS
): Promise<void> {
  const conn = await getMySQLPool().promise().getConnection();
  let destroyed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      conn.query("SELECT 1"),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          destroyed = true;
          try {
            conn.destroy();
          } catch {
            /* ignore */
          }
          reject(new Error("timeout"));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (!destroyed) {
      conn.release();
    }
  }
}

/** Bound Redis ping on a disposable duplicate so timeout can disconnect cleanly. */
export async function probeRedisReady(
  timeoutMs: number = READY_PROBE_MS
): Promise<void> {
  const client = REDIS_POOL.duplicate();
  try {
    await Promise.race([
      client.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      )
    ]);
  } finally {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
}
