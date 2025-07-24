import {RedisController} from "../../../models/RedisController";

export default class MessageCache extends RedisController {

    private EXPIRE_AFTER = 1000 * 60 * 60 * 6;
    private generateId = () => "message-" + Date.now().toString(36) + Math.random().toString(36).substring(2);
    private buildKey = (chatId: string, messageId: string) => `cria-embed:chats:${chatId}:messages:${messageId}`;

    async set(chatId: string, message: string, botGreetingId?: string): Promise<string> {
        const messageId: string = botGreetingId || this.generateId();

        await this.redis.set(
            this.buildKey(chatId, messageId),
            message,
            "EX",
            this.EXPIRE_AFTER
        );

        return messageId;

    }

    async get(chatId: string, messageId: string): Promise<string | null> {

        return this.redis.get(
            this.buildKey(chatId, messageId)
        )

    }

}
