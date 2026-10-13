import { createPool } from "mysql2/promise";
import * as fs from "fs";
import * as path from "path";
import { Config } from "../../config.js";

/**
 * Create the configured MySQL database and its base tables if they don't
 * exist yet. Idempotent (schema.sql uses IF NOT EXISTS) — safe to run on
 * every boot. Must complete before getMySQLPool() (pool.ts) is used, since
 * that pool connects directly to Config.MYSQL_DATABASE and has no bootstrap
 * logic of its own.
 */
export async function initializeDatabase(): Promise<void> {
  const schemaPath = path.join(Config.ASSETS_FOLDER_PATH, "schema.sql");
  const schema = fs
    .readFileSync(schemaPath, "utf-8")
    .replace(/%database%/g, Config.MYSQL_DATABASE);

  const bootstrapPool = createPool({
    host: Config.MYSQL_HOST,
    port: parseInt(Config.MYSQL_PORT),
    user: Config.MYSQL_USERNAME,
    password: Config.MYSQL_PASSWORD,
    multipleStatements: true
  });

  // GET_LOCK on the same connection as schema DDL (auto-releases on drop).
  // Acquire inside try/finally so a failed getConnection still ends the pool.
  const lockTimeout = Math.max(
    parseInt(process.env.DB_INIT_LOCK_TIMEOUT_SECONDS || "300", 10),
    30
  );
  try {
    const conn = await bootstrapPool.getConnection();
    try {
      const [lockRows]: any = await conn.query("SELECT GET_LOCK(?, ?) AS got", [
        "criaembed:db-init",
        lockTimeout
      ]);
      if (lockRows?.[0]?.got !== 1) {
        throw new Error(
          `Could not acquire the database init lock within ${lockTimeout}s; another replica is likely still migrating.`
        );
      }
      try {
        await conn.query(schema);
        console.log(
          `[MySQL Bootstrap] Database '${Config.MYSQL_DATABASE}' and base tables ready.`
        );
      } finally {
        await conn.query("SELECT RELEASE_LOCK(?)", ["criaembed:db-init"]);
      }
    } finally {
      conn.release();
    }
  } finally {
    await bootstrapPool.end();
  }
}
