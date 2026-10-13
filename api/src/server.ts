import { app } from "./app.js";
import { initializeDatabase } from "./database/mysql/bootstrap.js";
import { closeMySQLPool } from "./database/mysql/pool.js";
import { closeRedisPool } from "./database/redis/redis.js";

const port = process.env.PORT || 3003;
const DRAIN_TIMEOUT_MS = parseInt(
  process.env.SHUTDOWN_DRAIN_TIMEOUT_MS || "25000",
  10
);

async function main() {
  try {
    await initializeDatabase();
  } catch (err) {
    console.error("[MySQL Bootstrap] Failed to initialize database:", err);
    process.exit(1);
  }

  const server = app.listen(port, () =>
    console.log(`Listening on port ${port}`)
  );

  // Drain in-flight requests (incl. SSE), then close pools and exit.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(
      `[Shutdown] ${signal} received, draining for up to ${DRAIN_TIMEOUT_MS}ms`
    );
    server.close(async () => {
      await Promise.allSettled([closeMySQLPool(), closeRedisPool()]);
      process.exit(0);
    });
    setTimeout(() => {
      console.error("[Shutdown] Drain timeout, forcing exit");
      process.exit(1);
    }, DRAIN_TIMEOUT_MS).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main();
