import { createPool, Pool, PoolOptions } from "mysql2";
import * as fs from "fs";
import path from "path";

/**
 * Factory function to initialize and return a MySQL pool.
 * This should be called explicitly in app code, not at module top-level.
 * @param schema SQL schema string
 * @param config PoolOptions
 */
export async function getMySQLPool(schema: string, config: PoolOptions): Promise<Pool> {
  // First connect
  const initPoolConfig: PoolOptions = { ...config };
  initPoolConfig["database"] = undefined;
  initPoolConfig["multipleStatements"] = true;

  const initPool = createPool(initPoolConfig).promise();
  await initPool.query(schema);

  // Reconnect to created database
  return createPool(config).promise().pool;
}


