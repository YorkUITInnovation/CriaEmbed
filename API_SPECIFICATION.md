# CriaEmbed API Specification

## Authentication
- Endpoints under `/manage` and `POST /embed/{botId}/load` require `X-Api-Key` header.
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

Path Parameters:
- `botId` (string)

Query Parameters:
- `hideLauncher` (boolean, default `false`)
- `inlineLauncher` (boolean, default `false`)

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

Body (JSON):
- `sessionData`: object

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
- `chatId` (string)

Responses:
- `200 OK` (EmbedConfigResponse)

### POST /embed/{botId}/send
Sends a user prompt to the embedded chat and returns the bot reply.

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

Body (JSON): IBotBaseEmbedConfig

Responses:
- `200 OK` (InsertResponse)

### GET /manage/{botId}/config
Retrieve existing embed configuration.

Path Parameters:
- `botId` (string)

Headers:
- `X-Api-Key` (string)

Responses:
- `200 OK` (RetrieveResponse)

### PATCH /manage/{botId}/config
Update existing embed configuration.

Path Parameters:
- `botId` (string)

Headers:
- `X-Api-Key` (string)

Body (JSON): IBotBaseEmbedConfig

Responses:
- `200 OK` (UpdateResponse)

### DELETE /manage/{botId}/delete
Delete an embed configuration.

Path Parameters:
- `botId` (string)

Headers:
- `X-Api-Key` (string)

Responses:
- `200 OK` (DeleteResponse)


