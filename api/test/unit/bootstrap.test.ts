import { jest } from "@jest/globals";

jest.mock("../../src/config", () => ({
  Config: {
    ASSETS_FOLDER_PATH: "./src/assets/",
    MYSQL_DATABASE: "criaembed",
    MYSQL_HOST: "localhost",
    MYSQL_PORT: "3306",
    MYSQL_USERNAME: "root",
    MYSQL_PASSWORD: "cria"
  }
}));

const query = jest.fn();
const end = jest.fn();
const connQuery = jest.fn();
const release = jest.fn();
const getConnection = jest.fn(async () => ({ query: connQuery, release }));
const createPool = jest.fn(() => ({ query, end, getConnection }));

jest.mock("mysql2/promise", () => ({ createPool }));

import { initializeDatabase } from "../../src/database/mysql/bootstrap";

describe("initializeDatabase", () => {
  beforeEach(() => {
    query.mockReset();
    end.mockReset();
    connQuery.mockReset();
    release.mockReset();
    getConnection.mockClear();
    createPool.mockClear();
  });

  // Init lock: GET_LOCK → schema → RELEASE_LOCK on the same connection.
  const mockLockGranted = () =>
    connQuery.mockImplementation(async (sql: string) =>
      String(sql).startsWith("SELECT GET_LOCK") ? [[{ got: 1 }]] : undefined
    );

  it("runs the schema.sql with %database% substituted under the init lock, then closes the pool", async () => {
    mockLockGranted();

    await initializeDatabase();

    expect(createPool).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "localhost",
        port: 3306,
        user: "root",
        password: "cria",
        multipleStatements: true
      })
    );

    const executedSqls = connQuery.mock.calls.map(call => String(call[0]));
    expect(executedSqls[0]).toContain("GET_LOCK");
    const schemaSql = executedSqls[1];
    expect(schemaSql).toContain("CREATE DATABASE IF NOT EXISTS criaembed");
    expect(schemaSql).not.toContain("%database%");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS `EmbedBot`");
    expect(executedSqls[2]).toContain("RELEASE_LOCK");
    expect(release).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("still releases the lock and closes the pool if the schema query fails", async () => {
    connQuery.mockImplementation(async (sql: string) => {
      if (String(sql).startsWith("SELECT GET_LOCK")) return [[{ got: 1 }]];
      if (String(sql).startsWith("SELECT RELEASE_LOCK")) return undefined;
      throw new Error("connection refused");
    });

    await expect(initializeDatabase()).rejects.toThrow("connection refused");

    expect(release).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("fails fast when the init lock is held by another replica", async () => {
    connQuery.mockResolvedValue([[{ got: 0 }]]);

    await expect(initializeDatabase()).rejects.toThrow("init lock");

    expect(release).toHaveBeenCalledTimes(1);
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("closes the pool when getConnection fails before acquire cleanup", async () => {
    getConnection.mockRejectedValueOnce(new Error("acquire failed"));

    await expect(initializeDatabase()).rejects.toThrow("acquire failed");

    expect(release).not.toHaveBeenCalled();
    expect(end).toHaveBeenCalledTimes(1);
  });
});
