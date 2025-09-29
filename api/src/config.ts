import {config} from "dotenv";

const output = config({path: process.env.ENV_PATH || "./.env"});

if (output.error) {
  if (output.error.message.includes("EACCES")) {
    console.log("[ENV LOAD FAIL] No .env permission to read in the volume. chmod 644 /path/to/.env on host container.")
  } else {
    console.error("FAILED TO LOAD .ENV", output.error);
  }
}

type Config = {

  // MySQL
  MYSQL_PASSWORD: string
  MYSQL_PORT: string
  MYSQL_HOST: string
  MYSQL_USERNAME: string
  MYSQL_DATABASE: string

  // Redis
  REDIS_PORT: string,
  REDIS_HOST: string,
  REDIS_USERNAME: string,
  REDIS_PASSWORD: string,

  // Rate Limits
  RATE_LIMIT_EMBED_MINUTE_MAX: string,
  RATE_LIMIT_EMBED_HOUR_MAX: string,
  RATE_LIMIT_EMBED_DAY_MAX: string,
  RATE_LIMIT_CHAT_MINUTE_MAX: string,
  RATE_LIMIT_CHAT_HOUR_MAX: string,
  RATE_LIMIT_CHAT_DAY_MAX: string

  // General Settings
  WEB_APP_URL: string,
  CRIA_SERVER_URL: string,
  CRIA_BOT_SERVER_URL: string,
  CRIA_BOT_SERVER_TOKEN: string,
  CRIA_SERVER_TOKEN: string,
  THIS_APP_URL: string,
  ASSETS_FOLDER_PATH: string,
  DEFAULT_BOT_GREETING: string,
  AZURE_SPEECH_API_URL: string,
  AZURE_SPEECH_API_KEY: string,
  APP_MODE: "PRODUCTION" | "TESTING",

  // Elasticsearch
  ELASTICSEARCH_HOST: string,
  ELASTICSEARCH_PORT: string,
  ELASTICSEARCH_USERNAME: string,
  ELASTICSEARCH_PASSWORD: string,
  ELASTICSEARCH_INDEX: string,

  // RAGFlow
  RAGFLOW_EMBED_DIM: number,
  RAGFLOW_INDEX_NAME: string,
}


function processConfig(config: Config): Config {

  config.CRIA_BOT_SERVER_URL = config.CRIA_BOT_SERVER_URL.replace(/\/$/, "");
  config.CRIA_SERVER_URL = config.CRIA_SERVER_URL.replace(/\/$/, "");
  config.WEB_APP_URL = config.WEB_APP_URL.replace(/\/$/, "");
  config.THIS_APP_URL = config.THIS_APP_URL.replace(/\/$/, "");
  config.ASSETS_FOLDER_PATH ||= "./src/assets/";

  // Fallback to kill everything
  config.RATE_LIMIT_EMBED_MINUTE_MAX ||= "1";
  config.RATE_LIMIT_EMBED_HOUR_MAX ||= "1";
  config.RATE_LIMIT_EMBED_DAY_MAX ||= "1";
  config.RATE_LIMIT_CHAT_MINUTE_MAX ||= "1";
  config.RATE_LIMIT_CHAT_HOUR_MAX ||= "1";
  config.RATE_LIMIT_EMBED_MINUTE_MAX ||= "1";
  config.RATE_LIMIT_CHAT_DAY_MAX ||= "1";

  return config;
}

export function debugEnabled(): boolean {
  return process.env.DEBUG_ENABLED?.toLowerCase() === "true"
}

export const Config: Config = processConfig(process.env as Config);
