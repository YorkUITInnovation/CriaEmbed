import {
  ActivityHandler,
  Channels,
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  ConfigurationServiceClientCredentialFactory,
  TurnContext
} from "botbuilder";
import {ChannelHandler} from "./ChannelHandler";
import {EmailHandler} from "./channels/EmailHandler";
import {NextFunction} from "express";
import {EmbedService} from "../EmbedService";
import {IBotEmbed} from "../../database/mysql/controllers/BotEmbed";
import AzureChatCache from "../../database/redis/controllers/AzureChatCache";
import {TeamsHandler} from "./channels/TeamsHandler";

export class ChannelNotSupportedError extends Error {
}

export class MissingAzureAuthenticationError extends Error {

}

export function createCloudAdapter(
    appId: string,
    appPassword: string
) {
  const adapterAuthentication = new ConfigurationBotFrameworkAuthentication(
      undefined, new ConfigurationServiceClientCredentialFactory(
          {
            MicrosoftAppId: appId,
            MicrosoftAppPassword: appPassword,
            MicrosoftAppType: "MultiTenant",
            MicrosoftAppTenantId: "34531318-7011-4fd4-87f0-a43816c49bd0"
          }
      )
  );

  const adapter: CloudAdapter = new CloudAdapter(adapterAuthentication);

  adapter.onTurnError = async (context: TurnContext, error: Error) => {
    console.error(`[${Date.now()}] (onTurnError) Unhandled error: ${error.stack}`);
    await context.sendActivity('The bot encountered an error. Please try again later.');
  };

  return adapter;

}


export function getChannelHandler(
    embed: IBotEmbed,
    service: EmbedService,
    chatCache: AzureChatCache,
    context: TurnContext
): ChannelHandler {

  switch (context.activity.channelId) {

    case Channels.Email:
      return new EmailHandler(embed, service, chatCache);
    case Channels.Webchat:
    case Channels.Msteams:
      return new TeamsHandler(embed, service, chatCache);
    default:
      // "Gracefully" exit lol
      throw new ChannelNotSupportedError("Unsupported channel type: " + context.activity.channelId);
  }

}


function parseRegExpString(regExpString: string) {
  const regExpParts = regExpString.match(/^\/(.*?)\/([a-z]*)$/);
  if (regExpParts) {
    const pattern = regExpParts[1];
    const flags = regExpParts[2];
    return { pattern, flags };
  } else {
    // If the format does not match, return the input as is but handle it as having no flags
    return { pattern: regExpString, flags: undefined };
  }
}


export function getActivityHandler(
    embed: IBotEmbed,
    service: EmbedService,
    chatCache: AzureChatCache
): ActivityHandler {
  const activityHandler: ActivityHandler = new ActivityHandler();

  function shouldReply(context: TurnContext): boolean {

    if (!embed.integrationsWhitelistFilter) {
      return true;
    }

    const { pattern, flags } = parseRegExpString(embed.integrationsWhitelistFilter);
    return new RegExp(pattern, flags).test(context.activity.from.id);
  }

  // Handle messages
  async function onMessage(context: TurnContext, next: NextFunction): Promise<void> {
    if (shouldReply(context)) {
      const channelHandler: ChannelHandler = getChannelHandler(embed, service, chatCache, context);
      await channelHandler.onMessage(context);
    }
    next();
  }

  // Register & return the activity handler
  return activityHandler.onMessage(onMessage);
}
