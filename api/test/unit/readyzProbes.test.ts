import { jest } from "@jest/globals";

const query = jest.fn(async () => [[]]);
const release = jest.fn();
const destroy = jest.fn();
const getConnection = jest.fn(async () => ({ query, release, destroy }));
const promisePool = { getConnection };
const getMySQLPool = jest.fn(() => ({ promise: () => promisePool }));

const disconnect = jest.fn();
const ping = jest.fn(async () => "PONG");
const duplicate = jest.fn(() => ({ ping, disconnect }));

jest.mock("../../src/database/mysql/pool.js", () => ({
  getMySQLPool,
  closeMySQLPool: jest.fn(async () => {})
}));
jest.mock("../../src/database/redis/redis.js", () => ({
  REDIS_POOL: { duplicate, ping },
  closeRedisPool: jest.fn(async () => {})
}));

import { probeMysqlReady, probeRedisReady } from "../../src/readyzProbes";

describe("readyz probes", () => {
  beforeEach(() => {
    query.mockReset();
    query.mockImplementation(async () => [[]]);
    release.mockClear();
    destroy.mockClear();
    getConnection.mockClear();
    ping.mockClear();
    ping.mockImplementation(async () => "PONG");
    disconnect.mockClear();
    duplicate.mockClear();
  });

  it("releases MySQL connection on success", async () => {
    await probeMysqlReady(50);
    expect(getConnection).toHaveBeenCalled();
    expect(query).toHaveBeenCalled();
    expect(release).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
  });

  it("destroys MySQL connection on timeout so work does not accumulate", async () => {
    query.mockImplementationOnce(() => new Promise(() => {}));
    await expect(probeMysqlReady(20)).rejects.toThrow("timeout");
    expect(destroy).toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("disconnects disposable Redis client after ping", async () => {
    await probeRedisReady(50);
    expect(duplicate).toHaveBeenCalled();
    expect(ping).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled();
  });
});
