import Redis from "ioredis";
import {REDIS_POOL} from "../database/redis/redis";

export class RedisController {

    constructor(
        protected redis: Redis = REDIS_POOL
    ) {
    }
}
