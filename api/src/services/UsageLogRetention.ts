import { UsageLog } from "../database/mysql/controllers/UsageLog.js";

export const USAGE_LOG_PURGE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const USAGE_LOG_PURGE_BATCH_SIZE = 1000;

const SECONDS_PER_DAY = 86400;

/**
 * Epoch-seconds cutoff for the retention purge: rows with
 * timecreated older than this are deleted.
 */
export function usageLogRetentionCutoff(
  nowSeconds: number,
  retentionDays: number
): number {
  return Math.floor(nowSeconds) - retentionDays * SECONDS_PER_DAY;
}

/**
 * Delete all EmbedUsageLog rows older than `cutoffSeconds` in LIMIT chunks
 * so the purge never holds a table-wide lock. Resolves with the total
 * number of deleted rows.
 */
export async function purgeUsageLogs(
  usageLog: UsageLog,
  cutoffSeconds: number,
  batchSize: number = USAGE_LOG_PURGE_BATCH_SIZE
): Promise<number> {
  let total = 0;
  for (;;) {
    const deleted = await usageLog.deleteOlderThan(cutoffSeconds, batchSize);
    total += deleted;
    if (deleted < batchSize) break;
  }
  return total;
}

export interface UsageLogRetentionOptions {
  retentionDays: number;
  intervalMs?: number;
  batchSize?: number;
  now?: () => number;
}

/**
 * Start the usage-log retention purge: runs once immediately, then on a
 * fixed interval. Best-effort — a purge failure is logged and never
 * propagates. Returns a stop function that cancels future runs.
 */
export function startUsageLogRetention(
  usageLog: UsageLog,
  options: UsageLogRetentionOptions
): () => void {
  if (options.retentionDays <= 0) {
    console.log(
      "[UsageLog Retention] Disabled (EMBED_USAGE_LOG_RETENTION_DAYS <= 0)."
    );
    return () => {};
  }

  const intervalMs = options.intervalMs ?? USAGE_LOG_PURGE_INTERVAL_MS;
  const batchSize = options.batchSize ?? USAGE_LOG_PURGE_BATCH_SIZE;
  const now = options.now ?? (() => Date.now());

  let running = false;
  const runOnce = async (): Promise<void> => {
    if (running) return; // skip if the previous purge is still going
    running = true;
    try {
      const cutoff = usageLogRetentionCutoff(
        now() / 1000,
        options.retentionDays
      );
      const deleted = await purgeUsageLogs(usageLog, cutoff, batchSize);
      console.log(
        `[UsageLog Retention] Purged ${deleted} row(s) older than ${options.retentionDays} day(s) (cutoff ${cutoff}).`
      );
    } catch (err) {
      console.error("[UsageLog Retention] Purge failed:", err);
    } finally {
      running = false;
    }
  };

  void runOnce();
  const timer = setInterval(() => void runOnce(), intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
