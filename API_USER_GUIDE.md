# CriaEmbed API User Guide

This guide shows how to interact with the CriaEmbed API. You can use curl, Postman, or any HTTP client. All endpoints are rooted at:
```
https://your-api-domain.com/
```

## Table of Contents
1. Authentication
2. Common Error Format
3. Chats API
   - Check Session Exists
   - Create New Chat
4. Embed API
   - Load Embed Script (GET)
   - Load Embed Script with Session (POST)
   - Inline & Popup Assets
   - Retrieve Embed Config
   - Send Chat Message
   - Fetch Speech Audio
   - Retrieve Session Data
5. Integrations API
   - Azure Bot Webhook
6. Manage API
   - Insert Bot Config
   - Retrieve Bot Config
   - Update Bot Config
   - Delete Bot Config

---

## 1. Authentication

• **X-Api-Key** (header) is required for all `/manage/*` endpoints and `POST /embed/{botId}/load`.
• Other endpoints are public but subject to rate limits.

Example:
```
-H "X-Api-Key: YOUR_API_KEY"
```

---

## 2. Common Error Format

All error responses return JSON with schema:
```json
{
  "timestamp": "2025-08-11T12:34:56Z",
  "status": 404,
  "code": "NOT_FOUND",
  "message": "Resource not found",
  "detail": { /* optional */ }
}
```

---

## 3. Chats API

### 3.1 Check Session Exists
GET /chats/{chatId}/exists

Example:
```
curl -X GET "https://api.example.com/chats/abc123/exists"
```
Response:
```json
{
  "timestamp": "...",
  "status": 200,
  "code": "SUCCESS",
  "message": "Retrieved chat status!",
  "exists": true
}
```

### 3.2 Create New Chat
POST /chats/{chatId}/create

- `chatId`: previous session ID or `0` to start fresh.

Example:
```
curl -X POST "https://api.example.com/chats/0/create"
```
Response:
```json
{
  "timestamp": "...",
  "status": 200,
  "code": "SUCCESS",
  "message": "Created a chat!",
  "chatId": "newId123"
}
```

---

## 4. Embed API

### 4.1 Load Embed Script (GET)
GET /embed/{botId}/load

Query params:
- `hideLauncher` (boolean)
- `inlineLauncher` (boolean)

Example:
```
curl "https://api.example.com/embed/myBot/load?hideLauncher=false&inlineLauncher=true"
```
Returns JavaScript snippet. Copy & paste into `<script>` tag.

### 4.2 Load Embed Script with Session (POST)
POST /embed/{botId}/load

Headers:
```
X-Api-Key: YOUR_API_KEY
```
Body:
```json
{ "userId": 42, "role": "admin" }
```
Query params: `hideLauncher`, `inline`

Example:
```
curl -X POST "https://api.example.com/embed/myBot/load?inline=true" \
  -H "X-Api-Key: 1234" \
  -H "Content-Type: application/json" \
  -d '{"userId":42}'
```

### 4.3 Inline & Popup Assets

- **Inline script**: GET `/embed/{botId}/inline.js`
- **Popup HTML**: GET `/embed/{botId}/popup.html`
- **Popup script**: GET `/embed/{botId}/popup.js?hideLauncher=true`

Include by adding `<script src=".../inline.js"></script>` or in a modal.

### 4.4 Retrieve Embed Config
GET /embed/{botId}/config?chatId={chatId}

Returns public settings (theme, prompts, locale).

Example:
```
curl "https://api.example.com/embed/myBot/config?chatId=newId123"
```

### 4.5 Send Chat Message
POST /embed/{botId}/send

Body:
```json
{ "chatId": "newId123", "prompt": "Hello!" }
```
Example:
```
curl -X POST "https://api.example.com/embed/myBot/send" \
  -H "Content-Type: application/json" \
  -d '{"chatId":"newId123","prompt":"Hi"}'
```
Response:
```json
{
  "timestamp":"...",
  "status":200,
  "code":"SUCCESS",
  "reply":"Hello, how can I help?",
  "replyId":"msg456",
  "relatedPrompts":[{...}],
  "verifiedResponse":true
}
```

### 4.6 Fetch Speech Audio
GET /embed/{chatId}/speech?messageId={msgId}&language=en-US

Returns audio/webm stream or error JSON.

Example:
```
curl "https://api.example.com/embed/newId123/speech?messageId=msg456&language=en-US" --output reply.webm
```

### 4.7 Retrieve Session Data
GET /embed/{botId}/session_data?chatId={chatId}

Headers:
```
X-Api-Key: YOUR_API_KEY
```
Example:
```
curl -H "X-Api-Key:1234" "https://api.example.com/embed/myBot/session_data?chatId=newId123"
```
Response:
```json
{
  "timestamp":"...",
  "status":200,
  "code":"SUCCESS",
  "sessionData":{"userId":42}
}
```

---

## 5. Integrations API

### Azure Bot Webhook
POST /integrations/azure/messages

Receive messages from Azure Bot Service. Configure your Azure Bot channel to point to this URL.

Example:
```
curl -X POST "https://api.example.com/integrations/azure/messages" \
  -H "Content-Type: application/json" \
  -d @azurePayload.json
```
No content (`204`) returned if successful.

---

## 6. Manage API

All endpoints require:
```
Header: X-Api-Key: YOUR_ADMIN_KEY
```

### 6.1 Insert Bot Config
POST /manage/{botId}/insert

Body: IBotBaseEmbedConfig JSON

Example:
```
curl -X POST "https://api.example.com/manage/myBot/insert" \
  -H "X-Api-Key:1234" \
  -H "Content-Type: application/json" \
  -d '{"botName":"SupportBot","botIconUrl":"...","botGreeting":"Hi"}'
```

### 6.2 Retrieve Bot Config
GET /manage/{botId}/config

Example:
```
curl -H "X-Api-Key:1234" "https://api.example.com/manage/myBot/config"
```

### 6.3 Update Bot Config
PATCH /manage/{botId}/config

Same body as insert.

Example:
```
curl -X PATCH "https://api.example.com/manage/myBot/config" \
  -H "X-Api-Key:1234" \
  -H "Content-Type: application/json" \
  -d '{"botGreeting":"Welcome back"}'
```

### 6.4 Delete Bot Config
DELETE /manage/{botId}/delete

Example:
```
curl -X DELETE "https://api.example.com/manage/myBot/delete" \
  -H "X-Api-Key:1234"
```

---

**Need help?** Reach out to the CriaEmbed support team at support@cria.ai

