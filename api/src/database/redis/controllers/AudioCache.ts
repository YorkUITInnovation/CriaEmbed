import {RedisController} from "../../../models/RedisController";

export default class AudioCache extends RedisController {

    private EXPIRE_AFTER = 1000 * 60 * 30;
    private buildKey = (chatId: string, messageId: string) => `cria-embed:chats:${chatId}:messages:${messageId}:audio`;

    async set(chatId: string, messageId: string, audio: Buffer): Promise<string> {

        await this.redis.set(
            this.buildKey(chatId, messageId),
            audio,
            "EX",
            this.EXPIRE_AFTER
        );

        return messageId;
    }

    async get(chatId: string, messageId: string): Promise<Buffer | null> {

        return this.redis.getBuffer(
            this.buildKey(chatId, messageId)
        );

    }

}
