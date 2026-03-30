import RedisDefault from "ioredis";
import type { RedisOptions } from "ioredis";
import {Config} from "../../config.js";

// @ts-expect-error - ioredis default export is a constructor but TypeScript with Node16 module resolution doesn't recognize it
export const REDIS_POOL: InstanceType<typeof RedisDefault> = new RedisDefault({
    port: parseInt(Config.REDIS_PORT),
    host: Config.REDIS_HOST,
    username: Config.REDIS_USERNAME,
    password: Config.REDIS_PASSWORD,
    connectTimeout: 40_000,
    commandTimeout: 40_000
});




