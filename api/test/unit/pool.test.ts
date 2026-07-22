// Mock mysql2 before importing pool.ts so createPool is captured.
const mockPool = {
  on: jest.fn(),
  query: jest.fn((_sql: string, cb?: (err: unknown) => void) => cb && cb(null)),
  end: jest.fn(() => Promise.resolve())
};
const createPool = jest.fn(() => mockPool);

jest.mock("mysql2", () => ({ createPool }));

import { closeMySQLPool, getMySQLPool } from "../../src/database/mysql/pool";

describe("getMySQLPool", () => {
  it("creates the pool once and reuses the singleton across calls", () => {
    const a = getMySQLPool();
    const b = getMySQLPool();

    expect(a).toBe(b);
    expect(createPool).toHaveBeenCalledTimes(1);
  });

  it("configures sane pool options (keep-alive, bounded connections)", () => {
    getMySQLPool();
    const opts = createPool.mock.calls[0][0] as any;

    expect(opts.waitForConnections).toBe(true);
    expect(opts.connectionLimit).toBe(10);
    expect(opts.enableKeepAlive).toBe(true);
  });

  it("registers an error handler and runs a connection test query", () => {
    getMySQLPool();
    expect(mockPool.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockPool.query).toHaveBeenCalledWith(
      "SELECT 1",
      expect.any(Function)
    );
  });

  it("closes the singleton pool when requested", async () => {
    getMySQLPool();

    await closeMySQLPool();

    expect(mockPool.end).toHaveBeenCalledTimes(1);
  });
});
