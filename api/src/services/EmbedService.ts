import { randomUUID } from 'crypto';
import {VectorStoreService} from "./VectorStoreService.js";
import {BaseService} from "./BaseService.js";
import {BotLocale, EmbedPosition, IBotEmbed} from "../database/mysql/controllers/BotEmbed.js";
import {ManageService} from "./ManageService.js";
import {AxiosResponse} from "axios";
import {Config, debugEnabled} from "../config.js";
import {CriaError, CriaResponseCode, CriaResponseStatus, SendChatResponse} from "../models/CriaResponse.js";
import * as fs from "fs";
import path from "path";
import MessageCache from "../database/redis/controllers/MessageCache.js";
import {parse} from "node-html-parser";
import TrackingCache from "../database/redis/controllers/TrackingCache.js";
import {getMySQLPool} from "../database/mysql/pool.js";

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
  hideLauncher: boolean;
  inlineLauncher: boolean
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
  async createChat(): Promise<string> {
    return randomUUID();
  }

  private vectorStore: VectorStoreService;

    constructor(
        public readonly manageService: ManageService = new ManageService(getMySQLPool()),
        public readonly messageCache: MessageCache = new MessageCache(),
        public readonly trackingCache: TrackingCache = new TrackingCache()
    ) {
      super();
      this.vectorStore = new VectorStoreService();
    }

    // Upsert embedding to Elasticsearch
    async upsertEmbedding(id: string, embedding: number[], metadata: Record<string, any>): Promise<void> {
      await this.vectorStore.upsert(id, embedding, metadata);
    }

    // Search embeddings in Elasticsearch
    async searchEmbeddings(queryEmbedding: number[], k: number = 10): Promise<any[]> {
      return await this.vectorStore.search(queryEmbedding, k);
    }

  private async sendChat(
      botName: string,
      chatId: string,
      prompt: string,
      history: any[]
  ): Promise<CriaGetGPTResponseFunctionResponse> {

    // Retrieve embed record (for other metadata) then ask Criabot for the model id
    const botConfig: IBotEmbed = await this.manageService.retrieveBot(botName, "", true);

    // Fetch Criabot about to obtain llm_model_id (preferred source for Ragflow model id)
    let modelId: number | string | undefined;
    const maxAboutRetries = 3;
    for (let aboutAttempt = 0; aboutAttempt < maxAboutRetries; aboutAttempt++) {
      try {
        const aboutResp: AxiosResponse = await this.get(
          `${Config.CRIA_BOT_SERVER_URL}/bots/${botName}/manage/about`,
          { headers: { 'x-api-key': Config.CRIA_BOT_SERVER_TOKEN }, validateStatus: (status) => status < 500 }
        );

        modelId = aboutResp?.data?.about?.effective_config?.llm_model_id || aboutResp?.data?.about?.params?.llm_model_id;

        if (modelId) break;

        // If not found, wait a short exponential backoff before retrying
        if (aboutAttempt < maxAboutRetries - 1) {
          const wait = 250 * Math.pow(2, aboutAttempt);
          if (debugEnabled()) console.log(`[EmbedService] Criabot about did not include llm_model_id (attempt ${aboutAttempt + 1}), retrying in ${wait}ms`);
          await new Promise((r) => setTimeout(r, wait));
        }

      } catch (err: any) {
        // Unexpected error fetching about should abort early
        throw new CriaError(`Failed to determine Criabot model id for bot '${botName}': ${err?.message || 'unknown error'}`);
      }
    }

    if (!modelId) {
      if (debugEnabled()) console.error(`[EmbedService] Criabot about missing llm_model_id for bot '${botName}' after ${maxAboutRetries} attempts`);
      // Map to NOT FOUND so the integration test harness can treat it as a 404/Not Ready scenario
      throw new CriaError(`Criabot model id not available for bot '${botName}'`, 404);
    }

    // Ensure the ragflow model exists on the central server (Criadex) before calling it.
    await this.ensureModelReady(modelId);

    try {
      const ragflowUrl = `${Config.CRIA_SERVER_URL}/models/ragflow/${modelId}/agents/chat`;
      if (debugEnabled()) console.log(`[EmbedService] Sending ragflow chat to ${ragflowUrl}`);

      const response: AxiosResponse = await this.post(
          ragflowUrl,
          { history: history, chat_id: chatId },
          { headers: { 'x-api-key': Config.CRIA_SERVER_TOKEN }, validateStatus: (status) => status < 500 }
      );

      return response.data as CriaGetGPTResponseFunctionResponse;
    } catch (error: any) {
      // Normalise network / HTTP errors into a CriaError so callers can handle gracefully
      if (debugEnabled()) {
        console.error('[EmbedService] Ragflow call error:', error?.response?.status, error?.response?.data || error?.message);
      }

      const message =
          error?.response?.status
              ? `Criadex returned HTTP ${error.response.status}`
              : 'Criadex service is temporarily unavailable. Please try again later.';

      throw new CriaError(message);
    }
  }

  /**
   * Ensure a Ragflow model is available on Criadex before attempting chat.
   * Retries when 404 (model not found) for a short window.
   */
  private async ensureModelReady(modelId: number | string, maxRetries: number = 3, initialDelayMs: number = 500): Promise<void> {
    const url = `${Config.CRIA_SERVER_URL}/models/ragflow/${modelId}/about`;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const resp: AxiosResponse = await this.get(url, { headers: { 'x-api-key': Config.CRIA_SERVER_TOKEN }, validateStatus: (status) => status < 500 });

        if (resp.status === 200) {
          if (debugEnabled()) console.log(`[EmbedService] Model ${modelId} exists on Criadex`);
          return;
        }

        if (resp.status === 404) {
          if (attempt < maxRetries - 1) {
            const wait = initialDelayMs * Math.pow(2, attempt);
            if (debugEnabled()) console.log(`[EmbedService] Model ${modelId} not found on Criadex (attempt ${attempt + 1}), retrying in ${wait}ms`);
            await new Promise((r) => setTimeout(r, wait));
            continue;
          }

          if (debugEnabled()) console.log(`[EmbedService] Model ${modelId} not found after ${maxRetries} attempts`);
          throw new CriaError(`Ragflow model ${modelId} not found on Criadex`, 503);
        }

        // Any other status code treated as an upstream error
        throw new CriaError(`Unexpected response checking model on Criadex: ${resp.status}`, 502);

      } catch (err: any) {
        // If we intentionally raised a CriaError (e.g. 503 for model missing), rethrow it as-is
        if (err instanceof CriaError) {
          throw err;
        }

        if (attempt < maxRetries - 1) {
          const wait = initialDelayMs * Math.pow(2, attempt);
          if (debugEnabled()) console.log(`[EmbedService] Error when checking model readiness: ${err?.message || err}, retrying in ${wait}ms`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }

        if (debugEnabled()) console.log(`[EmbedService] Error verifying model readiness: ${err?.message || err}`);
        throw new CriaError(`Failed to verify model readiness for ${modelId}: ${err?.message || 'unknown'}`, 502);
      }
    }
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
      hideLauncher: boolean,
      inlineLauncher: boolean
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
      embedHoverTooltip: botConfig.embedHoverTooltip || null,
      hideLauncher: hideLauncher,
      inlineLauncher: inlineLauncher
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

    const history = [{ "role": "user", "content": prompt }];
    const apiResponse: CriaGetGPTResponseFunctionResponse = await this.sendChat(botName, chatId, prompt, history);
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
