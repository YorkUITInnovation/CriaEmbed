import {BaseService} from "./BaseService";
import {BotLocale, EmbedPosition, IBotEmbed} from "../database/mysql/controllers/BotEmbed";
import {ManageService} from "./ManageService";
import {AxiosResponse} from "axios";
import {Config, debugEnabled} from "../config";
import {CriaError, CriaResponseCode, CriaResponseStatus, SendChatResponse} from "../models/CriaResponse";
import * as fs from "fs";
import path from "path";
import MessageCache from "../database/redis/controllers/MessageCache";
import {parse} from "node-html-parser";
import TrackingCache from "../database/redis/controllers/TrackingCache";

const EMBED_BASE_SCRIPT: string = fs.readFileSync(
    path.join(Config.ASSETS_FOLDER_PATH, "/public/loader.js")
).toString();

type EmbedPopupConfig = {
  webAppUrl: string;
  chatApiUrl: string;
  botId: string;
  chatId: string;
  botName: string;
  embedTheme: string | null;
  botIconUrl: string;
  defaultEnabled?: boolean | null;
  embedPosition?: EmbedPosition;
  embedHoverTooltip?: string | null;
}

export type EmbedPublicConfig = {
  botId: string,
  botName: string,
  botSubName?: string | null,
  botGreeting: string,
  botGreetingId: string,
  botIconUrl: string,
  embedTheme: string | null,
  defaultEnabled?: boolean | null,
  embedPosition: EmbedPosition,
  watermarkEnabled?: boolean | null,
  botLocale: BotLocale,
  initialPrompts?: CriabotChatResponseRelatedPrompt[] | null,
  botTrustWarning?: string | null,
  botContact?: string | null
}

type CriaGetGPTResponseFunctionParams = {
  bot_id: string,
  chat_id: string,
  prompt: string,
  filters: string
}

export type CriaGetGPTResponseFunctionResponse = {
  prompt_tokens: number | null,
  completion_tokens: number | null,
  total_tokens: number | null,
  cost: number | null,
  file_name: string | null,
  message: string | null,
  stacktrace: string,
  reply: Record<string, string> | null,
  criabot_response: CriabotChatResponse | null,
}

export type CriabotChatResponseRelatedPrompt = {
  label: string,
  prompt: string,
}


export type CriabotChatReply = {
  related_prompts: CriabotChatResponseRelatedPrompt[]
  context: Record<string, any> | null
  verified_response: boolean
}

export type CriabotChatResponse = {
  status: number,
  message: string | null,
  timestamp: number,
  code: string,
  reply: CriabotChatReply | null
  total_usage: number | null
  related_prompts: CriabotChatResponseRelatedPrompt[]
}


export interface ExtendedSendChatResponse extends SendChatResponse {
  fullResponse?: CriabotChatResponse
}

export class EmbedService extends BaseService {

  constructor(
      public readonly manageService: ManageService = new ManageService(),
      public readonly messageCache: MessageCache = new MessageCache(),
      public readonly trackingCache: TrackingCache = new TrackingCache()
  ) {
    super();
  }

  async createChat(): Promise<string> {

    const response: AxiosResponse = await this.post(
        this.buildServiceURL(
            "cria_get_chat_id", {}
        )
    );

    const chatId: string = response.data;

    if (chatId) {
      return chatId;
    } else {
      throw new CriaError("Failed to receive a Chat ID!");
    }

  }

  private async sendChat(
      botName: string,
      chatId: string,
      prompt: string,
  ): Promise<CriaGetGPTResponseFunctionResponse> {

    const functionParams: CriaGetGPTResponseFunctionParams = {
      bot_id: botName,
      chat_id: chatId,
      prompt: prompt,
      filters: "" // Never any filters
    }

    const response: AxiosResponse = await this.post(
        this.buildServiceURL(
            "cria_get_gpt_response", functionParams
        )
    )

    if (response.data['criabot_response']) {
      response.data['criabot_response'] = JSON.parse(response.data['criabot_response']);
    }

    return response.data as CriaGetGPTResponseFunctionResponse;

  }

  async retrieveEmbedConfig(
      chatId: string,
      botName: string
  ): Promise<EmbedPublicConfig> {

    const botConfig: IBotEmbed = await this.manageService.retrieveBot(botName, "", true);
    const botGreeting: string = botConfig.botGreeting || Config.DEFAULT_BOT_GREETING;
    const botGreetingId = "greeting";

    if (!await this.messageCache.get(chatId, botGreeting)) {
      await this.messageCache.set(chatId, botGreeting, "greeting");
    }

    if (debugEnabled()) {
      console.log("Returning embed config for bot: " + botName, botConfig);
    }

    const config: EmbedPublicConfig = {
      botId: botConfig.botName,
      botName: botConfig.botTitle || botConfig.botName,
      botSubName: botConfig.botSubTitle,
      botGreeting: botGreeting,
      botGreetingId: botGreetingId,
      botIconUrl: botConfig.botIconUrl || Config.THIS_APP_URL + "/public/popup/cria.png",
      embedTheme: botConfig.botEmbedTheme || null,
      defaultEnabled: botConfig.botEmbedDefaultEnabled,
      embedPosition: botConfig.botEmbedPosition || EmbedPosition.BL,
      watermarkEnabled: botConfig.botWatermark,
      botLocale: botConfig.botLocale || "en-US",
      initialPrompts: botConfig.initialPrompts,
      botTrustWarning: botConfig.botTrustWarning || null,
      botContact: botConfig.botContact == null ? null : botConfig.botContact
    }

    if (config.embedTheme && !config.embedTheme.startsWith("#")) {
      config.embedTheme = "#" + config.embedTheme;
    }

    return config;

  }

  public async saveTrackingInfo(
      botName: string,
      chatId: string,
      sessionData: Record<string, any>,
      apiKey: string
  ): Promise<string> {
    await this.manageService.botExistsAndIsAuthorized(botName, apiKey);
    return this.trackingCache.set(chatId, sessionData);
  }

  public async transferTrackingInfo(
      previousChatId: string,
      newChatId: string
  ) {
    const trackingData = await this.trackingCache.get(previousChatId);
    await this.trackingCache.set(newChatId, trackingData);
  }

  public async getTrackingInfo(
      botName: string,
      chatId: string,
      apiKey: string
  ): Promise<Record<string, any> | null> {
    await this.manageService.botExistsAndIsAuthorized(botName, apiKey);
    return await this.trackingCache.get(chatId);
  }

  async retrieveEmbed(
      botName: string,
  ): Promise<[string, string]> {

    const botConfig: IBotEmbed = await this.manageService.retrieveBot(botName, "", true);
    const chatId: string = await this.createChat();

    const popupConfig: EmbedPopupConfig = {
      // Chat needs
      chatId: chatId,
      chatApiUrl: Config.THIS_APP_URL,
      webAppUrl: Config.WEB_APP_URL,
      botId: botName, // botName in this case refers to ID, I know, bad consistency

      // Popup needs
      botName: botConfig.botName,
      embedTheme: botConfig.botEmbedTheme || null,
      botIconUrl: botConfig.botIconUrl || Config.THIS_APP_URL + "/public/popup/cria.png",
      defaultEnabled: botConfig.botEmbedDefaultEnabled,
      embedPosition: botConfig.botEmbedPosition || EmbedPosition.BL,
      embedHoverTooltip: botConfig.embedHoverTooltip || null
    }

    const embedJs = EMBED_BASE_SCRIPT.replace(
        "$objectReplace",
        JSON.stringify(popupConfig)
    );

    return [embedJs, chatId];

  }


  async existsEmbedChat(chatId: string): Promise<boolean> {

    const response: AxiosResponse = await this.get(
        Config.CRIA_BOT_SERVER_URL + `/bots/chats/${chatId}/exists?x-api-key=${Config.CRIA_BOT_SERVER_TOKEN}`
    )

    if (response.data.code !== "SUCCESS") {
      throw new CriaError(
          "Error: " +
          (JSON.stringify(response.data))
      )
    }

    const exists: boolean | null | undefined = response.data.exists;

    if (exists === null || exists === undefined) {
      throw new CriaError(
          "Error: Response shows undefined exists. Payload read error?"
      )
    }

    return exists;


  }

  async sendEmbedChat(
      botName: string,
      chatId: string,
      prompt: string,
      fullResponse: boolean = false
  ): Promise<SendChatResponse | ExtendedSendChatResponse> {

    const apiResponse: CriaGetGPTResponseFunctionResponse = await this.sendChat(botName, chatId, prompt);
    const criaBotResponse = apiResponse.criabot_response;

    // Confirm not null
    if (criaBotResponse == null) {
      throw new CriaError(
          "Criabot response not found in reply from front-end. That's not good...!"
      );
    }

    if (criaBotResponse?.code !== "SUCCESS") {

      // Failed
      return {
        message: criaBotResponse.message || criaBotResponse.status.toString(),
        status: criaBotResponse.status as CriaResponseStatus,
        code: criaBotResponse.code as CriaResponseCode,
        timestamp: Date.now().toString(),
        reply: null,
        replyId: null,
        relatedPrompts: null,
        verifiedResponse: null
      }
    }

    if (!apiResponse.message) {
      throw new CriaError(
          "No response message was sent, likely due to an error."
      );
    }

    // Save ID for TTS
    const replyId: string | null = (
        apiResponse.message ? await this.messageCache.set(chatId, parse(apiResponse.message).textContent) : null
    );

    const verifiedResponse: boolean | undefined = criaBotResponse?.reply?.verified_response;

    const responseData: SendChatResponse = {
      message: criaBotResponse.message || "Success!", // Message refers to the RESPONSE message
      status: 200,
      code: "SUCCESS",
      timestamp: Date.now().toString(),
      reply: apiResponse.message, // Reply refers to the CONTENT reply
      replyId: replyId,
      relatedPrompts: criaBotResponse?.reply?.related_prompts || null,
      verifiedResponse: verifiedResponse == null ? null : verifiedResponse
    }

    if (fullResponse) {
      return {
        ...responseData,
        fullResponse: apiResponse.criabot_response || undefined
      }
    }

    return responseData;

  }

}
