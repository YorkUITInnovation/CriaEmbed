import { app } from "./app.js";
import { initializeDatabase } from "./database/mysql/bootstrap.js";

const port = process.env.PORT || 3003;

async function main() {
  try {
    await initializeDatabase();
  } catch (err) {
    console.error("[MySQL Bootstrap] Failed to initialize database:", err);
    process.exit(1);
  }

  app.listen(port, () => console.log(`Listening on port ${port}`));
}

main();
