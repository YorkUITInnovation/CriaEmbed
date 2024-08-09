import {ChannelHandler} from "../ChannelHandler";
import {MessageFactory, TurnContext} from "botbuilder";
import fs from "fs";
import path from "path";
import {Config} from "../../../config";

export class EmailHandler extends ChannelHandler {

  private static emailTemplate: string = fs.readFileSync(path.join(Config.ASSETS_FOLDER_PATH, '/email.html')).toString();

  async onMessage(context: TurnContext): Promise<any> {

    const retrievedChat = await this.getOrCreateChat(context);

    // If the first email only is enabled
    if (!retrievedChat.new && this.embed.integrationsFirstEmailOnly) {
      return;
    }

    const response = await this.getBotResponse(context, retrievedChat.chatId);

    if (!this.embed.integrationsNoContextReply && !response.reply?.context) {
      console.debug("No context reply, skipping email.");
      return;
    }

    const activity = MessageFactory.text(response.replyMessage);

    // Set reply as an HTML document
    activity.channelData = {
      htmlBody: (EmailHandler.emailTemplate + "")
          .replace("%message%", response.prompt)
          .replace("%reply%", response.replyMessage)
    };

    // Send the activity
    await context.sendActivity(activity);

  }

}