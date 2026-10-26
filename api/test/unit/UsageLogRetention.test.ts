import { usageLogRetentionDays } from "../../src/config";
import {
  purgeUsageLogs,
  startUsageLogRetention,
  usageLogRetentionCutoff,
  USAGE_LOG_PURGE_BATCH_SIZE
} from "../../src/services/UsageLogRetention";

describe("usageLogRetentionDays (env parsing)", () => {
  it("defaults to 30 days when unset", () => {
    expect(usageLogRetentionDays(undefined)).toBe(30);
  });

  it("parses a positive integer", () => {
    expect(usageLogRetentionDays("90")).toBe(90);
  });

  it("treats 0 or negative as disabled", () => {
    expect(usageLogRetentionDays("0")).toBe(0);
    expect(usageLogRetentionDays("-7")).toBe(-7);
  });

  it("throws on a non-integer value", () => {
    expect(() => usageLogRetentionDays("abc")).toThrow(
      "EMBED_USAGE_LOG_RETENTION_DAYS"
    );
  });
});

describe("usageLogRetentionCutoff", () => {
  it("subtracts the retention window in days from now", () => {
    expect(usageLogRetentionCutoff(1700000000, 30)).toBe(
      1700000000 - 30 * 86400
    );
  });

  it("floors sub-second input", () => {
    expect(usageLogRetentionCutoff(1700000000.9, 1)).toBe(1700000000 - 86400);
  });
});

describe("purgeUsageLogs", () => {
  it("deletes in batches until fewer than the batch size remain", async () => {
    const usageLog = {
      deleteOlderThan: jest
        .fn()
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1)
    };

    const total = await purgeUsageLogs(usageLog as any, 1699000000, 3);

    expect(total).toBe(7);
    expect(usageLog.deleteOlderThan).toHaveBeenCalledTimes(3);
    expect(usageLog.deleteOlderThan).toHaveBeenNthCalledWith(1, 1699000000, 3);
  });

  it("makes a single call when nothing is old enough to delete", async () => {
    const usageLog = { deleteOlderThan: jest.fn().mockResolvedValue(0) };

    const total = await purgeUsageLogs(usageLog as any, 1699000000);

    expect(total).toBe(0);
    expect(usageLog.deleteOlderThan).toHaveBeenCalledWith(
      1699000000,
      USAGE_LOG_PURGE_BATCH_SIZE
    );
  });

  it("propagates delete errors to the caller", async () => {
    const usageLog = {
      deleteOlderThan: jest.fn().mockRejectedValue(new Error("db down"))
    };

    await expect(purgeUsageLogs(usageLog as any, 1699000000)).rejects.toThrow(
      "db down"
    );
  });
});

describe("startUsageLogRetention", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const flush = async () => {
    // Let pending promises from runOnce() settle under fake timers.
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };

  it("is a no-op when retention is disabled (0 or negative)", () => {
    const usageLog = { deleteOlderThan: jest.fn() };
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const stop = startUsageLogRetention(usageLog as any, {
      retentionDays: 0
    });

    jest.advanceTimersByTime(48 * 60 * 60 * 1000);
    expect(usageLog.deleteOlderThan).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Disabled"));
    stop();
    logSpy.mockRestore();
  });

  it("purges immediately with the computed cutoff, then on the interval", async () => {
    const nowMs = 1700000000 * 1000;
    const usageLog = { deleteOlderThan: jest.fn().mockResolvedValue(0) };
    jest.spyOn(console, "log").mockImplementation(() => {});

    const stop = startUsageLogRetention(usageLog as any, {
      retentionDays: 30,
      intervalMs: 60000,
      now: () => nowMs
    });
    await flush();

    expect(usageLog.deleteOlderThan).toHaveBeenCalledTimes(1);
    expect(usageLog.deleteOlderThan).toHaveBeenCalledWith(
      1700000000 - 30 * 86400,
      USAGE_LOG_PURGE_BATCH_SIZE
    );

    jest.advanceTimersByTime(60000);
    await flush();
    expect(usageLog.deleteOlderThan).toHaveBeenCalledTimes(2);

    stop();
    jest.advanceTimersByTime(60000);
    await flush();
    expect(usageLog.deleteOlderThan).toHaveBeenCalledTimes(2);
    (console.log as jest.Mock).mockRestore();
  });

  it("swallows and logs purge errors without stopping the schedule", async () => {
    const usageLog = {
      deleteOlderThan: jest
        .fn()
        .mockRejectedValueOnce(new Error("db down"))
        .mockResolvedValue(0)
    };
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});

    const stop = startUsageLogRetention(usageLog as any, {
      retentionDays: 30,
      intervalMs: 60000
    });
    await flush();

    expect(errorSpy).toHaveBeenCalledWith(
      "[UsageLog Retention] Purge failed:",
      expect.any(Error)
    );

    // The next scheduled run still happens after a failure.
    jest.advanceTimersByTime(60000);
    await flush();
    expect(usageLog.deleteOlderThan).toHaveBeenCalledTimes(2);

    stop();
    errorSpy.mockRestore();
    (console.log as jest.Mock).mockRestore();
  });
});
