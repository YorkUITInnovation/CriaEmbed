import {config} from "dotenv";

config({path: process.env.DOTENV_PATH || "./src/assets/.env"});

type Config = {

    // MySQL
    MYSQL_PASSWORD: string
    MYSQL_PORT: string
    MYSQL_HOST: string
    MYSQL_USER: string
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
    BASE_PATH: string,
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

}


function processConfig(config: Config): Config {

    config.CRIA_BOT_SERVER_URL = config.CRIA_BOT_SERVER_URL.replace(/\/$/, "");
    config.CRIA_SERVER_URL = config.CRIA_SERVER_URL.replace(/\/$/, "");
    config.WEB_APP_URL = config.WEB_APP_URL.replace(/\/$/, "");
    config.THIS_APP_URL = config.THIS_APP_URL.replace(/\/$/, "");
    config.BASE_PATH = new URL(config.THIS_APP_URL).pathname;
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

export const Config: Config = processConfig(process.env as Config);
