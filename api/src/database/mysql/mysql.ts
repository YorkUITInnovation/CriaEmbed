import {createPool, Pool, PoolOptions} from "mysql2";
import * as fs from "fs";
import {Config} from "../../config";
import path from "path";

async function initializeDatabase(schema: string, config: PoolOptions): Promise<Pool> {

  // First connect
  const initPoolConfig: PoolOptions = {...config};
  initPoolConfig["database"] = undefined;
  initPoolConfig["multipleStatements"] = true;

  const initPool = createPool(initPoolConfig).promise();
  await initPool.query(schema);

  // Reconnect to created database
  return createPool(config).promise().pool;

}


export const MYSQL_POOL: Pool = await initializeDatabase(
    fs.readFileSync(path.join(Config.ASSETS_FOLDER_PATH, '/schema.sql'))
        .toString()
        .replaceAll(/%database%/g, Config.MYSQL_DATABASE),
    {
      password: Config.MYSQL_PASSWORD,
      port: parseInt(Config.MYSQL_PORT),
      host: Config.MYSQL_HOST,
      user: Config.MYSQL_USERNAME,
      database: Config.MYSQL_DATABASE
    }
);


