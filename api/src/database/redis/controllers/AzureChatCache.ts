import { RedisController } from "../../../models/RedisController.js";

export default class AzureChatCache extends RedisController {
  // Redis EX is in seconds - 7 days.
  private EXPIRE_AFTER = 60 * 60 * 24 * 7;
  private buildKey = (conversationId: string) =>
    `conversation-${conversationId}`;

  async set(conversationId: string, chatId: string): Promise<void> {
    await this.redis.set(
      this.buildKey(conversationId),
      chatId,
      "EX",
      this.EXPIRE_AFTER
    );
  }

  async delete(conversationId: string): Promise<void> {
    await this.redis.del(this.buildKey(conversationId));
  }

  async get(conversationId: string): Promise<string | null> {
    return this.redis.get(this.buildKey(conversationId));
  }

  async exists(conversationId: string): Promise<boolean> {
    return !!(await this.get(conversationId));
  }
}
