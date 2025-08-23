import Redis from "ioredis";
import {Config} from "../../config";

export const REDIS_POOL: Redis = new Redis({
    port: parseInt(Config.REDIS_PORT),
    host: Config.REDIS_HOST,
    username: Config.REDIS_USERNAME,
    password: Config.REDIS_PASSWORD,
    connectTimeout: 40_000,
    commandTimeout: 40_000,
    lazyConnect: true
});
