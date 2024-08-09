import {ChannelHandler} from "../ChannelHandler";
import {ActivityTypes, MessageFactory, TurnContext} from "botbuilder";

export class TeamsHandler extends ChannelHandler {

  protected async sendThinking(context: TurnContext) {
    await context.sendActivities([
      {
        type: ActivityTypes.Message,
        text: `Let me think about that...`
      },
      {type: ActivityTypes.Typing}
    ]);
  }

  async onMessage(context: TurnContext): Promise<any> {

    const retrievedChat = await this.getOrCreateChat(context);

    // Send thinking
    await this.sendThinking(context);

    // Get the response
    const chatResponse = await this.getBotResponse(context, retrievedChat.chatId);

    // Send the reply
    const activity = MessageFactory.text(chatResponse.replyMessage);
    await context.sendActivity(activity);

  }

}