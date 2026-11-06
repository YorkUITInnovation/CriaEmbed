import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { createRequire } from "node:module";
import test from "node:test";
import Redis from "ioredis";

// External persistence is isolated; Express, generated routes and services are real.
Redis.prototype.connect = async function () {};
Redis.prototype.quit = async function () {
  this.disconnect();
};
const mysql = createRequire(import.meta.url)("mysql2");
mysql.createPool = () => ({
  on() {},
  query(_sql, callback) {
    callback(null);
  },
  async end() {}
});

Object.assign(process.env, {
  ENV_PATH: "/dev/null",
  APP_MODE: "PRODUCTION",
  ASSETS_FOLDER_PATH: "./dist/src/assets/",
  REDIS_HOST: "",
  REDIS_PORT: "6379",
  MYSQL_HOST: "127.0.0.1",
  MYSQL_PORT: "3306",
  RAGFLOW_EMBED_DIM: "3",
  ELASTICSEARCH_HOST: "127.0.0.1",
  ELASTICSEARCH_PORT: "9200",
  CRIA_BOT_SERVER_TOKEN: "test-internal-key",
  EMBED_INTERNAL_TOKEN: "test-diagnostic-key",
  DEFAULT_BOT_GREETING: "Hello",
  DEBUG_ENABLED: "false",
  RATE_LIMIT_EMBED_MINUTE_MAX: "1000",
  RATE_LIMIT_EMBED_HOUR_MAX: "1000",
  RATE_LIMIT_EMBED_DAY_MAX: "1000",
  RATE_LIMIT_CHAT_MINUTE_MAX: "1000",
  RATE_LIMIT_CHAT_HOUR_MAX: "1000",
  RATE_LIMIT_CHAT_DAY_MAX: "1000"
});

test("built API remediation contracts", async t => {
  let upstreamCalls = 0;
  const upstream = createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "GET") {
      if (req.url.startsWith("/auth/")) {
        res.end(JSON.stringify({ authorized: true }));
      } else if (req.headers["x-api-key"] === "test-bot-key") {
        res.end("{}");
      } else {
        res.writeHead(403).end("{}");
      }
      return;
    }
    if (req.method === "PATCH") {
      res.end("{}");
      return;
    }
    upstreamCalls++;
    if (req.url.endsWith("/stream")) {
      res.setHeader("Content-Type", "text/event-stream");
      res.end(
        'data: {"type":"chunk","content":"Hello"}\n\ndata: {"type":"done"}\n\n'
      );
    } else {
      res.end(
        JSON.stringify({
          status: 200,
          code: "SUCCESS",
          reply: { content: { content: "<p>Hello</p>" } }
        })
      );
    }
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  process.env.CRIA_BOT_SERVER_URL = `http://127.0.0.1:${
    upstream.address().port
  }`;
  process.env.CRIA_SERVER_URL = process.env.CRIA_BOT_SERVER_URL;

  const { BotEmbed } = await import(
    "../../dist/src/database/mysql/controllers/BotEmbed.js"
  );
  const { default: TrackingCache } = await import(
    "../../dist/src/database/redis/controllers/TrackingCache.js"
  );
  const { default: MessageCache } = await import(
    "../../dist/src/database/redis/controllers/MessageCache.js"
  );
  const { UsageLog } = await import(
    "../../dist/src/database/mysql/controllers/UsageLog.js"
  );
  const { VectorStoreService } = await import(
    "../../dist/src/services/VectorStoreService.js"
  );
  const { closeRedisPool } = await import(
    "../../dist/src/database/redis/redis.js"
  );
  const { closeMySQLPool } = await import(
    "../../dist/src/database/mysql/pool.js"
  );
  const { app } = await import("../../dist/src/app.js");

  let bot = {
    id: 1,
    botName: "bot-a",
    publish: false,
    developerMode: "test-preview-key",
    microsoftAppPassword: "test-azure-password"
  };
  const tracking = new Map();
  const messages = new Map();
  BotEmbed.prototype.retrieveByName = async name =>
    name === bot.botName ? { ...bot } : undefined;
  BotEmbed.prototype.existsByName = async name => name === bot.botName;
  BotEmbed.prototype.update = async value => {
    bot = { ...value };
    return { ...bot };
  };
  TrackingCache.prototype.get = async id => tracking.get(id) ?? null;
  TrackingCache.prototype.set = async (id, value) => {
    tracking.set(id, value);
    return id;
  };
  MessageCache.prototype.get = async (id, messageId) =>
    messages.get(`${id}:${messageId}`) ?? null;
  MessageCache.prototype.set = async (id, value, messageId = "reply") => {
    messages.set(`${id}:${messageId}`, value);
    return messageId;
  };
  UsageLog.prototype.insert = async () => 1;

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  const request = (path, options) => fetch(url + path, options);
  let chatId;
  try {
    await t.test(
      "health, production docs and diagnostic authorization",
      async () => {
        assert.equal((await request("/livez")).status, 200);
        assert.equal((await request("/docs")).status, 404);
        assert.equal((await request("/manage/_diagnose")).status, 401);
      }
    );
    await t.test("browser preflight permits the preview header", async () => {
      const response = await request("/embed/bot-a/stream", {
        method: "OPTIONS",
        headers: {
          Origin: "https://customer.example",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type,X-Cria-Dev-Key"
        }
      });
      assert.equal(response.status, 204);
      assert.match(
        response.headers.get("access-control-allow-headers"),
        /X-Cria-Dev-Key/i
      );
    });
    await t.test(
      "required API keys are validated by generated routes",
      async () => {
        assert.equal((await request("/manage/bot-a/config")).status, 422);
      }
    );
    await t.test("retrieved redaction survives an actual PATCH", async () => {
      const headers = {
        "X-Api-Key": "test-bot-key",
        "Content-Type": "application/json"
      };
      const response = await request("/manage/bot-a/config", { headers });
      assert.equal(response.status, 200);
      const { config } = await response.json();
      assert.equal(config.developerMode, "[REDACTED]");
      assert.equal(config.microsoftAppPassword, "[REDACTED]");
      const patched = await request("/manage/bot-a/config", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ ...config, botTitle: "Changed title" })
      });
      assert.equal(patched.status, 200);
      assert.equal(bot.developerMode, "test-preview-key");
      assert.equal(bot.microsoftAppPassword, "test-azure-password");
      assert.equal(bot.botTitle, "Changed title");
    });
    await t.test("preview load initializes a bot-owned session", async () => {
      const response = await request(
        "/embed/bot-a/load?dev-key=test-preview-key"
      );
      assert.equal(response.status, 200);
      const loader = await response.text();
      chatId = JSON.parse(loader.match(/const botConfig = (.+);/)[1]).chatId;
      assert.equal(tracking.get(chatId).botName, "bot-a");
    });
    for (const route of ["send", "stream"]) {
      await t.test(
        `${route} validates the preview key on every turn`,
        async () => {
          const send = key =>
            request(`/embed/bot-a/${route}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(key ? { "X-Cria-Dev-Key": key } : {})
              },
              body: JSON.stringify({ chatId, prompt: "Hello" })
            });
          assert.equal((await send()).status, 404);
          const before = upstreamCalls;
          const response = await send("test-preview-key");
          assert.equal(response.status, 200);
          const body = await response.text();
          assert.match(body, /Hello/);
          assert.equal(upstreamCalls, before + 1);
          bot.developerMode = "rotated-preview-key";
          assert.equal((await send("test-preview-key")).status, 404);
          assert.equal(upstreamCalls, before + 1);
          tracking.set(chatId, { botName: "bot-b" });
          assert.equal((await send("rotated-preview-key")).status, 404);
          tracking.set(chatId, { botName: "bot-a", embedChatReady: true });
          bot.developerMode = "test-preview-key";
        }
      );
    }
    await t.test(
      "vector mapping upgrade and verified-owner re-upload remain isolated",
      async () => {
        const vectors = new VectorStoreService();
        let legacyCount = 1;
        const documents = new Map();
        let mapped = false;
        await vectors.close();
        vectors.client = {
          indices: {
            exists: async () => true,
            putMapping: async request => {
              assert.equal(
                request.properties.metadata.properties.botNamespace.type,
                "keyword"
              );
              mapped = true;
            }
          },
          index: async request => {
            documents.set(request.id, request.body);
          },
          count: async () => ({ count: legacyCount }),
          search: async request => {
            const owner =
              request.query.script_score.query.bool.filter[0].term[
                "metadata.botNamespace"
              ];
            return {
              hits: {
                hits: [...documents.values()].filter(
                  doc => doc.metadata.botNamespace === owner
                )
              }
            };
          }
        };
        await vectors.upsert("bot-a", "shared-id", [0.1, 0.2, 0.3], {
          botNamespace: "bot-b"
        });
        await vectors.upsert("bot-b", "shared-id", [0.3, 0.2, 0.1], {});
        assert.equal(mapped, true);
        await assert.rejects(
          () => vectors.search("bot-a", [0.1, 0.2, 0.3]),
          error => error.payload?.status === 409
        );
        legacyCount = 0;
        const results = await vectors.search("bot-a", [0.1, 0.2, 0.3]);
        assert.equal(results.length, 1);
        assert.equal(results[0].metadata.botNamespace, "bot-a");
      }
    );
  } finally {
    server.closeAllConnections();
    upstream.closeAllConnections();
    await Promise.all([
      new Promise(resolve => server.close(resolve)),
      new Promise(resolve => upstream.close(resolve)),
      closeRedisPool(),
      closeMySQLPool()
    ]);
  }
});
