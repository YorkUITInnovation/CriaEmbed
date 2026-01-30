import { createPool, Pool, PoolOptions } from "mysql2";
import {Config} from "../../config.js";

let MYSQL_POOL: Pool | undefined;

export function getMySQLPool(): Pool {
  if (!MYSQL_POOL) {
    const poolOptions: PoolOptions = {
      host: Config.MYSQL_HOST,
      port: parseInt(Config.MYSQL_PORT),
      user: Config.MYSQL_USERNAME,
      password: Config.MYSQL_PASSWORD,
      database: Config.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };
    
    console.log(`[MySQL Pool] Initializing connection to ${Config.MYSQL_HOST}:${Config.MYSQL_PORT}/${Config.MYSQL_DATABASE}`);
    MYSQL_POOL = createPool(poolOptions);
    
    // Handle connection errors
    MYSQL_POOL.on('error', (err) => {
      console.error('[MySQL Pool] Connection Error:', err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('[MySQL Pool] Connection lost, resetting pool');
        MYSQL_POOL = undefined; // Reset pool to allow reconnection
      }
    });
    
    // Test connection
    MYSQL_POOL.query('SELECT 1', (err) => {
      if (err) {
        console.error('[MySQL Pool] Initial connection test failed:', err);
      } else {
        console.log('[MySQL Pool] Connection test successful');
      }
    });
  }
  
  return MYSQL_POOL;
}
