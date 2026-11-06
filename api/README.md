# Cria Chat API

API for chatting with and embedding content for Cria bots.

## Configuration

This service is configured via environment variables. For local development, create a `.env` file in the root of the `/api` directory.

**Note:** For local development, service hosts (like `MYSQL_HOST` or `REDIS_HOST`) should be set to `localhost` or `127.0.0.1` and configured with the correct ports, assuming you are running the database services on your host machine.

### `.env` Template

```
# --- Service Ports & URLs
CRIA_SERVER_URL="http://localhost/"
CRIA_BOT_SERVER_URL="http://localhost:25575/"
CRIA_BOT_CHAT_TIMEOUT_MS=90000
THIS_APP_URL="http://localhost:3003/embed-api"
WEB_APP_URL="http://localhost:4000/embed"

# --- Database Credentials
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USERNAME=root
MYSQL_PASSWORD=cria
MYSQL_DATABASE=criaembed

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=password

# --- Elasticsearch (used by the standalone vector-store upsert/search endpoints)
ELASTICSEARCH_HOST=localhost
ELASTICSEARCH_PORT=9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=elastic
ELASTICSEARCH_INDEX=criaembed
RAGFLOW_EMBED_DIM=768

# --- API Keys & Tokens (replace with actual values)
CRIA_SERVER_TOKEN=<your_cria_server_token>
CRIA_BOT_SERVER_TOKEN=<your_criabot_server_token>
# Shared secret for Criabot→CriaEmbed internal calls (usage-log gateway).
# Must match Criabot's CRIAEMBED_INTERNAL_TOKEN.
EMBED_INTERNAL_TOKEN=<shared-internal-token>

# --- Usage-Log Retention (optional)
# Days to keep EmbedUsageLog rows before the startup purge job deletes them
# (batched deletes, runs daily). Default: 30. Set to 0 or negative to disable.
EMBED_USAGE_LOG_RETENTION_DAYS=30
AZURE_SPEECH_API_KEY=<your_azure_speech_api_key>

# --- Application Settings
AZURE_SPEECH_API_URL="https://canadacentral.tts.speech.microsoft.com/cognitives"
ASSETS_FOLDER_PATH="./dist/src/assets/"
DEFAULT_BOT_GREETING="Hello there! Got a question?"
APP_MODE=DEVELOPMENT
DEBUG_ENABLED=false

# --- Rate Limiting (optional)
RATE_LIMIT_MINUTE_MAX=30
RATE_LIMIT_HOUR_MAX=120
RATE_LIMIT_DAY_MAX=1000
```

## Docker

`docker build .` from this directory builds everything in-image (builder
stage runs `npm ci` + `npm run build`); no host `npm install`/dist needed.
`./build.sh` builds and pushes the release image (override with
`VERSION=...`).

## Local Development

1.  **Install dependencies from the `/api` directory:**

    ```sh
    npm install
    ```

2.  **Run the test suite:**

    ```sh
    npm run test
    ```

3.  **Start the development server:**
    This command will start the server with hot-reloading enabled.
    ```sh
    npm run dev
    ```

## Testing

`npm test -- --runInBand` generates TSOA routes and the OpenAPI specification
before running Jest, including on a fresh checkout. Use `npm run build` for
the production TypeScript and asset build.

After building, `npm run test:runtime` exercises the built Express/TSOA
routes over HTTP, including browser preflight, preview load/send/stream,
secret PATCH round trips and vector upgrade behavior. External persistence
and provider responses are isolated fixtures; it does not alter a running
CRIA stack. The same command can run in a rebuilt API image with
`test/integration` mounted read-only at `/home/cria/test/integration`.

## Developer preview and secret updates

Unpublished bots require a matching `dev-key` when loading/configuring the
widget and `X-Cria-Dev-Key` on each `/send` or `/stream` request. The widget
forwards this header automatically. Preview keys are checked against the
current configuration on every turn, without bypassing session ownership.

Manage responses redact `developerMode` and `microsoftAppPassword` as
`[REDACTED]`. PATCH treats that reserved value (or omission) as unchanged;
real strings replace secrets, and `null` or an empty string clears them.
Inserts reject the placeholder.

## Vector index upgrades

Vectors are now bot-scoped. Existing indexes receive an explicit keyword
mapping for `metadata.botNamespace`; new writes set this field and use
namespaced document IDs. Existing unowned vectors are never automatically
assigned to a bot. Searches return HTTP 409 while any unowned documents
remain, instead of silently returning incomplete results.

Before deploying against an existing vector index:

1. Snapshot/back up the index and inventory documents missing
   `metadata.botNamespace` (Elasticsearch `must_not` + `exists` query).
2. Establish each document's owning bot from an authoritative external
   source. Do not infer ownership from arbitrary metadata or document IDs.
3. Re-upload each vector through that bot's authenticated
   `/embed/{botId}/load/embedding/upsert` route. Use the same bot identifier
   for writes and searches. Wait for Elasticsearch refresh and verify the
   new vector and its namespace.
4. Only after verifying each replacement, remove that document's old,
   unnamespaced copy by its exact ID. Keep unverified documents in the
   backup; do not delete or assign them speculatively.
5. Confirm that the unowned-document count is zero, then test searches
   for at least two bots to verify isolation.

If an existing `metadata.botNamespace` mapping conflicts with `keyword`,
create a new index with the current mapping, re-upload under verified
ownership, then switch `ELASTICSEARCH_INDEX`. Do not modify the old index
or its backup to work around a mapping error.
