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

  try {
    await bootstrapPool.query(schema);
    console.log(
      `[MySQL Bootstrap] Database '${Config.MYSQL_DATABASE}' and base tables ready.`
    );
  } finally {
    await bootstrapPool.end();
  }
}
