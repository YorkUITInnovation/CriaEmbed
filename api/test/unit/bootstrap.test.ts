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
const createPool = jest.fn(() => ({ query, end }));

jest.mock("mysql2/promise", () => ({ createPool }));

import { initializeDatabase } from "../../src/database/mysql/bootstrap";

describe("initializeDatabase", () => {
  beforeEach(() => {
    query.mockReset();
    end.mockReset();
    createPool.mockClear();
  });

  it("runs the schema.sql with %database% substituted, then closes the pool", async () => {
    query.mockResolvedValue(undefined);

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

    const executedSql = query.mock.calls[0][0] as string;
    expect(executedSql).toContain("CREATE DATABASE IF NOT EXISTS criaembed");
    expect(executedSql).not.toContain("%database%");
    expect(executedSql).toContain("CREATE TABLE IF NOT EXISTS `EmbedBot`");
    expect(end).toHaveBeenCalledTimes(1);
  });

  it("still closes the pool if the schema query fails", async () => {
    query.mockRejectedValue(new Error("connection refused"));

    await expect(initializeDatabase()).rejects.toThrow("connection refused");

    expect(end).toHaveBeenCalledTimes(1);
  });
});
