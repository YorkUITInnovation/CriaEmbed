import { Config, redisDatabase } from "../../src/config";

jest.mock("ioredis", () =>
  jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    call: jest.fn(),
    quit: jest.fn().mockResolvedValue("OK"),
    disconnect: jest.fn()
  }))
);
jest.mock("rate-limit-redis", () => jest.fn().mockImplementation(() => ({})));
jest.mock("express-rate-limit", () => jest.fn(() => jest.fn()));

describe("Redis database selection", () => {
  it("passes explicit state and limiter DBs to the actual client constructors", () => {
    const previousDb = process.env.REDIS_DB;
    const previousLimitDb = process.env.RATE_LIMIT_REDIS_DB;
    process.env.REDIS_DB = "3";
    process.env.RATE_LIMIT_REDIS_DB = "4";
    try {
      jest.isolateModules(() => {
        require("../../src/database/redis/redis");
        require("../../src/models/LimitGenerator");
        expect(jest.requireMock("ioredis")).toHaveBeenCalledWith(
          expect.objectContaining({ db: 3 })
        );
        expect(jest.requireMock("ioredis")).toHaveBeenCalledWith(
          expect.objectContaining({ db: 4 })
        );
      });
    } finally {
      if (previousDb === undefined) delete process.env.REDIS_DB;
      else process.env.REDIS_DB = previousDb;
      if (previousLimitDb === undefined) delete process.env.RATE_LIMIT_REDIS_DB;
      else process.env.RATE_LIMIT_REDIS_DB = previousLimitDb;
    }
  });

  it("configures the main pool to fail fast and registers an error listener", () => {
    jest.isolateModules(() => {
      require("../../src/database/redis/redis");
      expect(jest.requireMock("ioredis")).toHaveBeenCalledWith(
        expect.objectContaining({
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false
        })
      );
      const instances = (jest.requireMock("ioredis") as jest.Mock).mock.results
        .map((r: { type: string; value: { on?: jest.Mock } }) =>
          r.type === "return" ? r.value : undefined
        )
        .filter(Boolean);
      expect(
        instances.some(inst =>
          inst!.on!.mock.calls.some((call: unknown[]) => call[0] === "error")
        )
      ).toBe(true);
    });
  });

  it("disconnects instead of quit() when the pool never became ready", async () => {
    let pool: { status?: string; quit: jest.Mock; disconnect: jest.Mock };
    let closeRedisPool: () => Promise<void>;
    jest.isolateModules(() => {
      const mod = require("../../src/database/redis/redis");
      pool = mod.REDIS_POOL;
      closeRedisPool = mod.closeRedisPool;
    });
    pool!.status = "connecting";
    await closeRedisPool!();
    expect(pool!.disconnect).toHaveBeenCalledTimes(1);
    expect(pool!.quit).not.toHaveBeenCalled();
  });

  it("preserves the existing DB 0 default", () => {
    expect(redisDatabase(undefined, "REDIS_DB")).toBe(0);
    expect(Config.REDIS_DB).toBe(0);
    expect(Config.RATE_LIMIT_REDIS_DB).toBe(0);
  });

  it("accepts explicit database numbers", () => {
    expect(redisDatabase("2", "REDIS_DB")).toBe(2);
  });

  it.each(["", "-1", "1.5", "abc", "01", "9007199254740992"])(
    "rejects invalid database %s instead of silently selecting DB 0",
    value => expect(() => redisDatabase(value, "REDIS_DB")).toThrow("REDIS_DB")
  );
});
