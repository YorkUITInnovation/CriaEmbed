# CriaEmbed API Specification

## Authentication

- Endpoints under `/manage`, `POST /embed/{botId}/load`, and `POST /embed/{botId}/load/embedding/{upsert,search}` require `X-Api-Key` header.
- `GET /internal/usage-logs` requires `X-Internal-Token` matching `EMBED_INTERNAL_TOKEN` (server-to-server; used by Criabot's usage-log gateway — not the public widget API key).
- When Criabot pushes embed config updates, it sends `X-Internal-Service: criabot` so CriaEmbed skips syncing publish status back (prevents a feedback loop). Outbound CriaEmbed→Criabot calls send `X-Internal-Service: criaembed` to bypass Criabot rate limits.
- Other endpoints are public but may enforce rate limits.

## Error Responses

All error responses conform to the `CriaResponse` schema:

```json
{
  "timestamp": "string",
  "status": number,
  "code": "ERROR|UNAUTHORIZED|NOT_FOUND|DUPLICATE|TOO_MANY_REQUESTS|INVALID",
  "message": "string",
  "detail": { /* optional extra data */ }
}
```

---

## 1. Chats

### GET /chats/{chatId}/exists

Checks if a chat session exists or is expired.

Path Parameters:

- `chatId` (string, required)

Responses:

- `200 OK` (ExistsChatResponse)

### POST /chats/{chatId}/create

Creates a new chat session, optionally transferring tracking from a previous chat.

Path Parameters:

- `chatId` (string, previous chat ID)

Responses:

- `200 OK` (CreateChatResponse)

---

## 2. Embed

### GET /embed/{botId}/load

Returns embeddable JavaScript snippet to initialize a chat widget.

Visibility rule: only published bots are available. If `publish` is not explicitly
`true`, this endpoint returns `404 NOT_FOUND` unless a matching `dev-key` query
parameter is supplied and the bot's `developerMode` config value matches it.

Path Parameters:

- `botId` (string)

Query Parameters:

- `hideLauncher` (boolean, default `false`)
- `inlineLauncher` (boolean, default `false`)
- `dev-key` (string, optional) — bypasses the publish gate when it matches the bot's `developerMode` config value

Produces: `application/javascript`

Responses:

- `200 OK` (JavaScript | CriaResponse)

### POST /embed/{botId}/load

Same as GET, but allows passing initial session data.

Headers:

- `X-Api-Key` (string)

Query Parameters:

- `hideLauncher` (boolean)
- `inline` (boolean)
- `dev-key` (string, optional) — bypasses the publish gate when it matches the bot's `developerMode` config value

Body (JSON):

- `sessionData`: object (optional). Persisted in Redis for the new `chatId` returned via the `X-Chat-Id` response header.
- `payload`: object (optional) — key/value pairs for [Personalization Payload](#personalization-payload) (may also be nested as `sessionData.payload` in the JSON body).

Example:

```json
{
  "payload": {
    "year_of_study": "3rd year",
    "faculty": "Science"
  }
}
```

Produces: `application/javascript`

Responses:

- `200 OK` (JavaScript | CriaResponse)

### GET /embed/{botId}/inline.js

Returns inline embed script.

Path Parameters:

- `botId` (string)

Produces: `application/javascript`

Responses:

- `200 OK` (JavaScript)

### GET /embed/{botId}/popup.html

Returns HTML for popup embed.

Path Parameters:

- `botId` (string)

Produces: `application/javascript`

Responses:

- `200 OK` (HTML as JS string)

### GET /embed/{botId}/popup.js

Returns popup launcher script.

Path Parameters:

- `botId` (string)

Query Parameters:

- `hideLauncher` (boolean)

Produces: `application/javascript`

Responses:

- `200 OK` (JavaScript)

### GET /embed/{botId}/config

Retrieves public embed configuration for a session.

Path Parameters:

- `botId` (string)

Query Parameters:

- `chatId` (string, required)
- `dev-key` (string, optional) — same publish bypass as `/load`

Responses:

- `200 OK` (`EmbedConfigResponse`)
  ```json
  {
    "status": 200,
    "code": "SUCCESS",
    "config": {
      "botId": "myBot",
      "botName": "myBot",
      "botSubName": null,
      "botGreeting": "Hello!",
      "botGreetingId": "string",
      "botIconUrl": "https://example.com/icon.png",
      "embedTheme": "#ffffff",
      "defaultEnabled": true,
      "embedPosition": 2,
      "watermarkEnabled": true,
      "botLocale": "en-US",
      "initialPrompts": [],
      "botTrustWarning": null,
      "botContact": null
    }
  }
  ```
- `404 NOT_FOUND` if `chatId` doesn't exist/is expired.
  Also returned when the bot is unpublished (unless a matching `dev-key` is supplied).

### POST /embed/{botId}/send

Sends a user prompt to the embedded chat and returns the bot reply. Forwards to Criabot with any resolved personalization block as `system_ephemeral_payload`. Assistant `reply` text is HTML (Criabot converts markdown server-side).

Path Parameters:

- `botId` (string)

Body (JSON):

```json
{
  "chatId": "string",
  "prompt": "string"
}
```

Responses:

- `200 OK` (SendChatResponse)

### POST /embed/{botId}/stream

Same as `POST /embed/{botId}/send`, but streams the reply as Server-Sent Events instead of a single JSON response.

Path Parameters:

- `botId` (string)

Body (JSON): same as `POST /embed/{botId}/send`

```json
{
  "chatId": "string",
  "prompt": "string"
}
```

Produces: `text/event-stream` on success. If the upstream request fails before streaming starts, returns a normal `CriaResponse` JSON error instead (e.g. `404 NOT_FOUND` if the bot doesn't have embeds enabled).

#### Chat latency and transport guarantees

- `/send` and `/stream` load the current bot configuration and chat tracking
  concurrently. A normal message reads tracking once for the mapped Criabot
  chat ID, prompt context, and personalization. Bot configuration is not cached,
  so edits remain visible across API replicas without invalidation delays.
- CriaEmbed shares HTTP/HTTPS keep-alive agents across service instances. Each
  agent permits 64 connections per origin, 256 total, and 16 idle connections
  per origin. Caller transport overrides and the
  `CRIA_BOT_CHAT_TIMEOUT_MS` budget remain supported.
- The streaming endpoint forwards upstream chunks without accumulating the
  answer. It sends `X-Accel-Buffering: no` and
  `Cache-Control: no-cache, no-transform`. The deployed proxy/CDN must honor
  these headers; application tests cannot verify external proxy configuration.
- Both endpoints limit prompts to 4000 characters. The streaming endpoint
  rejects longer prompts with a `400` error before calling Criabot.
- Chat POSTs are non-idempotent. CriaEmbed retries connection-establishment
  failures (`ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`, without an HTTP response)
  once, after 300 ms. It does not replay requests after timeouts, socket resets,
  or HTTP server errors. Missing Criabot chats retain the create/map/retry-once
  recovery flow; unused upstream error streams are destroyed.
- Usage writes remain awaited rather than being moved to a lossy in-memory
  background task.
- Criabot runs at most two retrieval prompt variants concurrently, preserving
  original merge order, search accounting, sources, and reranking behavior.
  Each variant retains the existing group-search behavior. Failure or
  cancellation cancels and awaits sibling searches.
- Criabot does not replay Criadex generation calls (chat, related prompts,
  transform) after HTTP errors, read/write timeouts, or protocol errors. Only
  connection-establishment failures retain bounded retries. Read-only search
  calls retain their existing retry policy. This avoids duplicate generation
  and repeated timeout delays when a response is lost after a POST was accepted.
- Criadex reuses a lifespan-managed HTTP client for Ragflow completions,
  including ownership-conflict recovery. Its connection limit matches the
  existing LLM admission limit, with up to 16 idle connections. Shutdown closes
  the client; standalone agents retain their own short-lived client.

This reduces avoidable request overhead without changing model selection,
generation settings, or retrieval quality. The current upstream SSE path emits
retrieval/synthesis status events, then chunks the completed model answer; it
does not yet provide end-to-end token streaming from Ragflow. Measure both time
to first **answer** chunk and total turn duration in deployment rather than
treating the first status event as an answer-speed measurement.

#### Regression test cases

From `CriaEmbed/api`, run `npm test -- --runInBand`. Transport and chat tests
cover:

- One tracking read per normal message, concurrent independent lookups, and no
  upstream dispatch before both succeed.
- Mapped/canonical identifiers, enriched prompts, personalization, and edits
  taking effect on the next message.
- Actual TCP connection reuse against a local server; connection bounds and
  caller overrides.
- Safe retry limits, non-replay of ambiguous failures, bounded missing-chat
  recovery, and cleanup of discarded HTTP error streams.
- SSE chunk delivery before completion, anti-buffering headers, and the exact
  4000/4001-character validation boundary.

From `criabot`, run
`venv/bin/python -m pytest -q test/test_retriever.py test/test_criadex_client.py`
for bounded parallel retrieval, deterministic merging, failure/cancellation
cleanup, and safe generation-call retry policy.
From `criadex`, run
`venv/bin/python -m pytest -q test/test_ragflow_chat_resilience.py`
for shared-client ownership, recovery, and application-lifespan cleanup.
Tests use mocked providers or local transports, not live model credentials.

#### Responsive embedding

- Popup embeds retain their desktop size (350 by 550 pixels), constrained by
  available viewport space. At widths up to 600 pixels or heights up to 480
  pixels, open popups fill the viewport and hide the launcher/resize handles.
  Visual Viewport resize/scroll events update the popup bounds when mobile
  keyboards, zoom, or browser controls change the visible area.
- Pointer Events support mouse, pen, and touch resizing on larger viewports.
  Dimensions remain viewport-bounded; pointer cancellation, lost capture, and
  window blur release the resize overlay.
- Inline embeds retain a 350 by 600 pixel preferred size, with a maximum width
  of 100% of their host container and a maximum height of `100dvh`. Host
  containers should have a definite available width. This is not automatic
  content-height negotiation.
- Chat layouts track the visible iframe viewport, keep the composer visible,
  constrain input growth, use compact headers on narrow/short screens, and
  account for safe-area insets. Wide code blocks scroll internally, and message
  media is constrained to the bubble.
- Popup close messages are scoped to the iframe's window and origin. Closing
  one popup does not unlock host scrolling while another is still open.
  Launcher buttons expose expanded state and have keyboard button semantics;
  iframes and close buttons have accessible labels.
- Empty or failed streams show an error rather than silently submitting the
  same non-idempotent prompt again through `/send`.

Run `npm test` and `npm run build` from `CriaEmbed/app` for frontend regression
checks. Tests exercise viewport updates/cleanup, pointer resizing/cancellation,
multi-popup scroll state, iframe-scoped close messages, inline sizing, and
non-replay of failed/empty chat streams.

Browser validation uses controlled config/answer responses with actual app and
popup assets at 280x400, 320x568, 350x550, short landscape, and 1024x768 sizes.
Verify long titles, URLs, code, tables, composer visibility, and returning from
full-screen to desktop. These checks do not replace testing a real iOS/Android
on-screen keyboard or measuring live model/proxy latency.

### POST /embed/{botId}/load/embedding/upsert

> Nested under the `/embed/{botId}/load` route for historical reasons; `botId` is accepted in the path but not used by the handler — this is an internal/admin operation, not part of the public embed widget surface.

Requires `X-Api-Key` header (validated against the same auth check used by `/manage`, see Authentication above — not bot-scoped since this route isn't tied to a specific bot).

Upserts a raw vector into CriaEmbed's own Elasticsearch index (`criaembed` by default) — independent of Criadex/Ragflow's own indices.

Headers:

- `X-Api-Key` (string, required)

Body (JSON):

```json
{
  "id": "string",
  "embedding": [0.1, 0.2, "..."],
  "metadata": {}
}
```

Responses:

- `200 OK` (`CriaResponse`)
- `401 UNAUTHORIZED` if the API key is missing or invalid

### POST /embed/{botId}/load/embedding/search

Requires `X-Api-Key` header (same check as upsert above).

Semantic search against the same Elasticsearch index via cosine similarity.

Headers:

- `X-Api-Key` (string, required)

Body (JSON):

```json
{
  "queryEmbedding": [0.1, 0.2, "..."],
  "k": 10
}
```

Responses:

- `200 OK`
  ```json
  {
    "results": [
      {
        "_id": "string",
        "_score": 0.0,
        "_source": { "embedding": [], "metadata": {} }
      }
    ]
  }
  ```
- `401 UNAUTHORIZED` if the API key is missing or invalid

### GET /embed/{chatId}/speech

Streams synthesized speech audio for a chat message.

Path Parameters:

- `chatId` (string)

Query Parameters:

- `messageId` (string)
- `language` (`fr-FR` | `en-US`)

Produces: `audio/webm`

Responses:

- `200 OK` (binary stream or ChatAudioResponse)

### GET /embed/{botId}/session_data

Retrieves saved session data for a chat.

Path Parameters:

- `botId` (string)

Headers:

- `X-Api-Key` (string)

Query Parameters:

- `chatId` (string)

Responses:

- `200 OK` (SessionDataResponse)

---

## 3. Integrations

### POST /integrations/azure/messages

Webhook endpoint for Azure Bot Service messages.

Body: raw JSON from Azure.

Responses:

- `204 No Content`

---

## 4. Manage

All management endpoints require `X-Api-Key` header.

### POST /manage/{botId}/insert

Create or insert embed configuration for a bot.

Path Parameters:

- `botId` (string)

Headers:

- `X-Api-Key` (string)

Body (JSON): `IBotBaseEmbedConfig`

```json
{
  "botTitle": "Bot Title",
  "botSubTitle": "Bot Subtitle",
  "botGreeting": "Hello!",
  "botIconUrl": "https://example.com/icon.png",
  "publish": true,
  "developerMode": null,
  "botEmbedTheme": "#ffffff",
  "botEmbedDefaultEnabled": true,
  "botEmbedPosition": 2,
  "botWatermark": true,
  "botLocale": "en-US",
  "botTrustWarning": "Warning message",
  "initialPrompts": [],
  "personalizationPayload": [
    {
      "variableName": "year_of_study",
      "systemMessage": "I am a [year_of_study] student."
    }
  ],
  "microsoftAppId": "app-id",
  "microsoftAppPassword": "app-password",
  "integrationsNoContextReply": true,
  "integrationsFirstEmailOnly": false,
  "integrationsWhitelistFilter": "*",
  "embedHoverTooltip": "Click me!",
  "botContact": "contact@example.com"
}
```

`publish` is mirrored from Criabot and defaults to `false` (fail closed). `developerMode` is an optional string key; when set (and `publish` is false), callers can load the widget with `?dev-key=<key>` for staging.

Note: `botEmbedPosition` values are: `1` (Bottom Left), `2` (Bottom Right), `3` (Top Right), `4` (Top Left).

Responses:

- `200 OK` (`InsertResponse`) — includes the full persisted `config: IBotEmbed` (same fields as the request body, plus `id`, `botName`, `createdAt`).
- `409 DUPLICATE` if a config for this `botId` already exists.

### GET /manage/{botId}/config

Retrieve existing embed configuration.

Path Parameters:

- `botId` (string)

Headers:

- `X-Api-Key` (string)

Responses:

- `200 OK` (`RetrieveResponse`) — includes `config: IBotEmbed`.
- `404 NOT_FOUND` if no config exists for this `botId`.

### PATCH /manage/{botId}/config

Update existing embed configuration.

Path Parameters:

- `botId` (string)

Headers:

- `X-Api-Key` (string)
- `X-Internal-Service` (optional) — when `criabot`, skip syncing publish/developerMode back to Criabot (Criabot already owns that write).

Body (JSON): `IBotBaseEmbedConfig` (see POST /insert for example body)

Behavior:

- If `publish` and/or `developerMode` are explicitly present in the body (and the caller is not Criabot), CriaEmbed PATCHes Criabot's `/bots/{botId}/manage/publish` with the mapped 3-state status (`published` / `develop` / `unpublished`). Unrelated field updates do not trigger a sync.
- Requires `CRIA_BOT_SERVER_TOKEN` for outbound sync.

Responses:

- `200 OK` (`UpdateResponse`) — includes the updated `config: IBotEmbed`.

### DELETE /manage/{botId}/delete

Delete an embed configuration.

Path Parameters:

- `botId` (string)

Headers:

- `X-Api-Key` (string)

Responses:

- `200 OK` (DeleteResponse)

---

## 5. Internal (server-to-server)

### GET /internal/usage-logs

Paginated embed usage-log rows (token/cost tracking). Called by Criabot's `GET /bots/{bot_name}/usage-logs` gateway — not for browser clients.

**Cost semantics:** when `CRIAEMBED_MODEL_COST_RATES` is unset or missing the
active model, `cost` is `null` and chat responses include `cost_unknown: true`.
Treat null as **unknown**, never as free (`0`).

Headers:

- `X-Internal-Token` (string, required) — must equal `EMBED_INTERNAL_TOKEN`

Query Parameters (all optional):

- `bot_id` (number)
- `bot_name` (string)
- `userid` (number)
- `timecreated_from` / `timecreated_to` (unix timestamps)
- `page` (default `1`), `limit` (default `50`)

Responses:

- `200 OK`
  ```json
  {
    "status": 200,
    "code": "SUCCESS",
    "message": "Successfully retrieved usage logs.",
    "items": [],
    "page": 1,
    "limit": 50,
    "total": 0
  }
  ```
- `401 UNAUTHORIZED` if the internal token is missing/invalid

---

## 6. Health & Diagnostics

### GET /health_check

Returns service health status.

Responses:

- `200 OK`
  ```json
  {
    "status": "ok",
    "service": "CriaEmbed API",
    "timestamp": "string",
    "uptime": 12345,
    "version": "string"
  }
  ```

### GET /manage/\_diagnose

Returns internal diagnostics for the service, including a live reachability check against Criabot.

Responses:

- `200 OK`
  ```json
  {
    "status": "ok",
    "diagnostics": {
      "service": "CriaEmbed API",
      "timestamp": 1234567890,
      "criabot": {
        "url": "http://criabot:25575",
        "reachable": true,
        "status": 200,
        "error": null
      }
    }
  }
  ```

---

## Personalization Payload

See mars plugin `CRIAEMBED_AGENT_API_SPECIFICATION.md` §6.6 for the full contract. Summary:

- **Config:** `personalizationPayload` on insert/update (`[{ variableName, systemMessage }]` with `[variableName]` placeholders).
- **Runtime:** `POST /embed/{botId}/load` body `{ "payload": { "year_of_study": "3rd year", ... } }` with `X-Api-Key` (may also nest as `sessionData.payload`).
- **Rules:** skip entries when `payload[variableName]` is missing/empty; no leftover `[tokens]`.
- **Effect:** resolved block cached per `chatId`, sent to Criabot as `system_ephemeral_payload` on every embed `/send` and `/stream` (does not rewrite the bot's stored system prompt).

Assistant replies are returned as HTML from Criabot (markdown converted server-side) for both RAG and web-search answers.
