import AudioCache from "../../src/database/redis/controllers/AudioCache";
import AzureChatCache from "../../src/database/redis/controllers/AzureChatCache";
import TrackingCache from "../../src/database/redis/controllers/TrackingCache";
import { closeRedisPool } from "../../src/database/redis/redis";

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    getBuffer: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn()
  }));
});

// Redis EX is expressed in SECONDS. These assert the corrected (non-ms) TTLs.
describe("Redis cache TTL + key coherency", () => {
  let redis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    redis = {
      get: jest.fn(),
      getBuffer: jest.fn(),
      set: jest.fn(),
      del: jest.fn()
    };
  });

  it("closes the shared redis pool when requested", async () => {
    const redisClient = (await import("../../src/database/redis/redis"))
      ?.REDIS_POOL as any;

    await closeRedisPool();

    expect(redisClient.quit).toHaveBeenCalledTimes(1);
  });

  describe("AudioCache", () => {
    let cache: AudioCache;
    beforeEach(() => {
      cache = new AudioCache();
      (cache as any).redis = redis;
    });

    it("writes audio under a namespaced key with a 30-minute (seconds) TTL", async () => {
      const buf = Buffer.from("audio-bytes");
      const id = await cache.set("chat1", "msg1", buf);

      expect(id).toBe("msg1");
      expect(redis.set).toHaveBeenCalledWith(
        "cria-embed:chats:chat1:messages:msg1:audio",
        buf,
        "EX",
        60 * 30
      );
    });

    it("reads audio as a Buffer", async () => {
      const buf = Buffer.from("x");
      redis.getBuffer.mockResolvedValueOnce(buf);
      const out = await cache.get("chat1", "msg1");
      expect(out).toBe(buf);
      expect(redis.getBuffer).toHaveBeenCalledWith(
        "cria-embed:chats:chat1:messages:msg1:audio"
      );
    });
  });

  describe("AzureChatCache", () => {
    let cache: AzureChatCache;
    beforeEach(() => {
      cache = new AzureChatCache();
      (cache as any).redis = redis;
    });

    it("stores the mapping with a 7-day (seconds) TTL", async () => {
      await cache.set("conv1", "chat-abc");
      expect(redis.set).toHaveBeenCalledWith(
        "conversation-conv1",
        "chat-abc",
        "EX",
        60 * 60 * 24 * 7
      );
    });

    it("deletes by conversation id", async () => {
      await cache.delete("conv1");
      expect(redis.del).toHaveBeenCalledWith("conversation-conv1");
    });

    it("exists() reflects presence", async () => {
      redis.get.mockResolvedValueOnce("chat-abc");
      expect(await cache.exists("conv1")).toBe(true);
      redis.get.mockResolvedValueOnce(null);
      expect(await cache.exists("conv1")).toBe(false);
    });
  });

  describe("TrackingCache", () => {
    let cache: TrackingCache;
    beforeEach(() => {
      cache = new TrackingCache();
      (cache as any).redis = redis;
    });

    it("stores JSON with a 24-hour (seconds) TTL", async () => {
      const data = { courseId: 42 };
      const id = await cache.set("chat1", data);
      expect(id).toBe("chat1");
      expect(redis.set).toHaveBeenCalledWith(
        "cria-embed:tracking:chat1",
        JSON.stringify(data),
        "EX",
        60 * 60 * 24
      );
    });

    it("returns parsed JSON, or {} when the key is absent", async () => {
      redis.get.mockResolvedValueOnce(JSON.stringify({ a: 1 }));
      expect(await cache.get("chat1")).toEqual({ a: 1 });

      redis.get.mockResolvedValueOnce(null);
      expect(await cache.get("chat1")).toEqual({});
    });
  });
});
