import {TurnContext} from "botbuilder";
import {IBotEmbed} from "../../database/mysql/controllers/BotEmbed";
import {CriabotChatReply, EmbedService, ExtendedSendChatResponse} from "../EmbedService";
import {Context} from "node:vm";
import AzureChatCache from "../../database/redis/controllers/AzureChatCache";

export abstract class ChannelHandler {

  constructor(
      protected readonly embed: IBotEmbed,
      protected readonly service: EmbedService,
      protected readonly chatCache: AzureChatCache
  ) {
  }

  abstract onMessage(context: TurnContext): Promise<void>;

  protected async getOrCreateChat(context: TurnContext): Promise<{ chatId: string, new: boolean }> {
    let chatId: string | null = await this.chatCache.get(context.activity.conversation.id);
    let newChat = false;

    if (chatId && !await this.service.existsEmbedChat(chatId)) {
      await this.chatCache.delete(context.activity.conversation.id);
      chatId = null;
    }

    if (chatId == null) {
      newChat = true;
      chatId = await this.service.createChat();
      await this.chatCache.set(context.activity.conversation.id, chatId);
    }

    return {chatId: chatId, new: newChat};

  }

  protected async getBotResponse(
      context: Context,
      chatId: string
  ): Promise<{ prompt: string, replyMessage: string, reply?: CriabotChatReply}> {
    const prompt: string = context.activity.text;

    // Get the response
    const chatResponse = await this.service.sendEmbedChat(
        this.embed.botName,
        chatId,
        prompt,
        true
    ) as ExtendedSendChatResponse;

    // Get the reply content
    let replyMessage: string = chatResponse.reply || "";
    if (chatResponse.status !== 200) {
      replyMessage = `Sorry, but the bot failed with status code ${chatResponse.status} (Chat ID: ${chatId}).`;
    }

    return {prompt: prompt, replyMessage: replyMessage, reply: chatResponse.fullResponse?.reply || undefined};
  }

}

