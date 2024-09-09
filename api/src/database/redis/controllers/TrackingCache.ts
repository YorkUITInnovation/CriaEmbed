import {RedisController} from "../../../models/RedisController";

export default class TrackingCache extends RedisController {

  private EXPIRE_AFTER = 60 * 60 * 24; // Keep for 24 hours
  private buildKey = (chatId: string) => `cria-embed:tracking:${chatId}`;

  async set(chatId: string, trackingData: Record<string, any>): Promise<string> {

    await this.redis.set(
        this.buildKey(chatId),
        JSON.stringify(trackingData),
        "EX",
        this.EXPIRE_AFTER
    );

    return chatId;

  }

  async get(chatId: string): Promise<string | null> {

    return this.redis.get(
        this.buildKey(chatId)
    )

  }

}
