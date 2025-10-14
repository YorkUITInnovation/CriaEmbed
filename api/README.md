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
THIS_APP_URL="http://localhost:3003/embed-api"
WEB_APP_URL="http://localhost:4000/embed"

# --- Database Credentials
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USERNAME=root
MYSQL_PASSWORD=cria
MYSQL_DATABASE=criabot

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_USERNAME=default
REDIS_PASSWORD=password

# --- API Keys & Tokens (replace with actual values)
CRIA_SERVER_TOKEN=<your_cria_server_token>
CRIA_BOT_SERVER_TOKEN=<your_criabot_server_token>
AZURE_SPEECH_API_KEY=<your_azure_speech_api_key>

# --- Application Settings
AZURE_SPEECH_API_URL="https://canadacentral.tts.speech.microsoft.com/cognitives"
ASSETS_FOLDER_PATH="./dist/src/assets/"
DEFAULT_BOT_GREETING="Hello there! Got a question?"
APP_MODE=TEST
DEBUG_ENABLED=false

# --- Rate Limiting (optional)
RATE_LIMIT_MINUTE_MAX=30
RATE_LIMIT_HOUR_MAX=120
RATE_LIMIT_DAY_MAX=1000
```

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