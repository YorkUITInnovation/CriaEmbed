import Redis from "ioredis";
import {REDIS_POOL} from "../database/redis/redis.js";

export class RedisController {

    constructor(
        public redis: Redis = REDIS_POOL
    ) {
    }
}
