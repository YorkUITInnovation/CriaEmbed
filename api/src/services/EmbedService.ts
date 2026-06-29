import { randomUUID } from "crypto";
import { VectorStoreService } from "./VectorStoreService.js";
import { BaseService } from "./BaseService.js";
import {
  BotLocale,
  EmbedPosition,
  IBotEmbed
} from "../database/mysql/controllers/BotEmbed.js";
import { ManageService } from "./ManageService.js";
import { AxiosResponse } from "axios";
import { Config, debugEnabled } from "../config.js";
import {
  CriaError,
  CriaResponseCode,
  CriaResponseStatus,
  SendChatResponse
} from "../models/CriaResponse.js";
import * as fs from "fs";
import path from "path";
import MessageCache from "../database/redis/controllers/MessageCache.js";
import { parse } from "node-html-parser";
import TrackingCache from "../database/redis/controllers/TrackingCache.js";
import { getMySQLPool } from "../database/mysql/pool.js";
import { buildEmbedCriabotPrompt } from "./embedPrompt.js";

const EMBED_BASE_SCRIPT: string = fs
  .readFileSync(path.join(Config.ASSETS_FOLDER_PATH, "/public/loader.js"))
  .toString();

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
  inlineLauncher: boolean;
};

export type EmbedPublicConfig = {
  botId: string;
  botName: string;
  botSubName?: string | null;
  botGreeting: string;
  botGreetingId: string;
  botIconUrl: string;
  embedTheme: string | null;
  defaultEnabled?: boolean | null;
  embedPosition: EmbedPosition;
  watermarkEnabled?: boolean | null;
  botLocale: BotLocale;
  initialPrompts?: CriabotChatResponseRelatedPrompt[] | null;
  botTrustWarning?: string | null;
  botContact?: string | null;
};

type CriaGetGPTResponseFunctionParams = {
  bot_id: string;
  chat_id: string;
  prompt: string;
  filters: string;
};

export type CriaGetGPTResponseFunctionResponse = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cost: number | null;
  file_name: string | null;
  message: string | null;
  stacktrace: string;
  reply: Record<string, string> | null;
  criabot_response: CriabotChatResponse | null;
};

export type CriabotChatResponseRelatedPrompt = {
  label: string;
  prompt: string;
};

export type CriabotChatReply = {
  related_prompts: CriabotChatResponseRelatedPrompt[];
  context: Record<string, any> | null;
  verified_response: boolean;
};

export type CriabotChatResponse = {
  status: number;
  message: string | null;
  timestamp: number;
  code: string;
  reply: CriabotChatReply | null;
  total_usage: number | null;
  related_prompts: CriabotChatResponseRelatedPrompt[];
};

export interface ExtendedSendChatResponse extends SendChatResponse {
  fullResponse?: CriabotChatResponse;
}

export class EmbedService extends BaseService {
  async createChat(): Promise<string> {
    return randomUUID();
  }

  private async ensureGreetingMessage(
    chatId: string,
    greeting: string
  ): Promise<void> {
    if (!(await this.messageCache.get(chatId, "greeting"))) {
      await this.messageCache.set(chatId, greeting, "greeting");
    }
  }

  private vectorStore: VectorStoreService;

  constructor(
    public readonly manageService: ManageService = new ManageService(
      getMySQLPool()
    ),
    public readonly messageCache: MessageCache = new MessageCache(),
    public readonly trackingCache: TrackingCache = new TrackingCache()
  ) {
    super();
    this.vectorStore = new VectorStoreService();
  }

  // Upsert embedding to Elasticsearch
  async upsertEmbedding(
    id: string,
    embedding: number[],
    metadata: Record<string, any>
  ): Promise<void> {
    await this.vectorStore.upsert(id, embedding, metadata);
  }

  // Search embeddings in Elasticsearch
  async searchEmbeddings(
    queryEmbedding: number[],
    k: number = 10
  ): Promise<any[]> {
    return await this.vectorStore.search(queryEmbedding, k);
  }

  private async sendChat(
    botName: string,
    chatId: string,
    prompt: string,
    history: any[]
  ): Promise<CriaGetGPTResponseFunctionResponse> {
    // Resolve to the canonical bot name stored by embed config.
    const botConfig: IBotEmbed = await this.manageService.retrieveBot(
      botName,
      "",
      true
    );
    const canonicalBotName = botConfig.botName;

    try {
      // Delegate chat execution to Criabot. It already resolves current model selection,
      // inheritance, fallback behavior, and response formatting.
      let criabotChatId = await this.getMappedCriabotChatId(chatId);
      if (!criabotChatId) {
        criabotChatId = chatId;
      }

      const trackingData = await this.trackingCache.get(chatId);
      const criabotPrompt = buildEmbedCriabotPrompt(prompt, trackingData);

      let response: AxiosResponse = await this.postCriabotChat(
        criabotChatId,
        canonicalBotName,
        criabotPrompt
      );

      // If Criabot does not know this chat id yet, create one and retry once.
      if (response?.status === 404) {
        const startedChatId = await this.startCriabotChat();
        await this.setMappedCriabotChatId(chatId, startedChatId);
        criabotChatId = startedChatId;
        response = await this.postCriabotChat(
          criabotChatId,
          canonicalBotName,
          criabotPrompt
        );
      }

      const chatUrl = `${
        Config.CRIA_BOT_SERVER_URL
      }/bots/chats/${encodeURIComponent(criabotChatId)}/send`;
      if (debugEnabled())
        console.log(
          `[EmbedService] Sending chat to Criabot endpoint ${chatUrl}`
        );

      const reply = response?.data?.reply;
      const relatedPrompts = reply?.related_prompts || [];
      const normalizedCriabotResponse: CriabotChatResponse = {
        status: response?.data?.status || response?.status || 500,
        message: response?.data?.message || null,
        timestamp: Number(response?.data?.timestamp || Date.now()),
        code: response?.data?.code || "ERROR",
        reply: {
          related_prompts: relatedPrompts,
          context: reply?.context || null,
          verified_response: Boolean(reply?.verified_response)
        },
        total_usage: response?.data?.reply?.total_usage?.total_tokens ?? null,
        related_prompts: relatedPrompts
      };

      return {
        prompt_tokens: null,
        completion_tokens: null,
        total_tokens: null,
        cost: null,
        file_name: null,
        message: reply?.content?.content || null,
        stacktrace: "",
        reply: null,
        criabot_response: normalizedCriabotResponse
      };
    } catch (error: any) {
      // Normalise network / HTTP errors into a CriaError so callers can handle gracefully
      if (debugEnabled()) {
        console.error(
          "[EmbedService] Criabot chat error:",
          error?.response?.status,
          error?.response?.data || error?.message
        );
      }

      const message = error?.response?.status
        ? `Criabot returned HTTP ${error.response.status}`
        : "Criabot service is temporarily unavailable. Please try again later.";

      throw new CriaError(message);
    }
  }

  private async postCriabotChat(
    criabotChatId: string,
    canonicalBotName: string,
    prompt: string
  ): Promise<AxiosResponse> {
    const chatUrl = `${
      Config.CRIA_BOT_SERVER_URL
    }/bots/chats/${encodeURIComponent(criabotChatId)}/send`;
    return this.post(
      chatUrl,
      {
        bot_name: canonicalBotName,
        prompt
      },
      {
        headers: { "x-api-key": Config.CRIA_BOT_SERVER_TOKEN },
        validateStatus: status => status < 500
      }
    );
  }

  private async startCriabotChat(): Promise<string> {
    const response: AxiosResponse = await this.post(
      `${Config.CRIA_BOT_SERVER_URL}/bots/chats/start`,
      {},
      {
        headers: { "x-api-key": Config.CRIA_BOT_SERVER_TOKEN },
        validateStatus: status => status < 500
      }
    );

    const startedChatId = response?.data?.chat_id;
    if (!startedChatId || typeof startedChatId !== "string") {
      throw new CriaError("Failed to initialize Criabot chat session.", 502);
    }
    return startedChatId;
  }

  private async getMappedCriabotChatId(
    embedChatId: string
  ): Promise<string | null> {
    const trackingData = await this.trackingCache.get(embedChatId);
    const mapped = trackingData?.criabotChatId;
    return typeof mapped === "string" && mapped.length > 0 ? mapped : null;
  }

  private async setMappedCriabotChatId(
    embedChatId: string,
    criabotChatId: string
  ): Promise<void> {
    const trackingData = await this.trackingCache.get(embedChatId);
    const nextTracking = {
      ...(trackingData || {}),
      criabotChatId
    };
    await this.trackingCache.set(embedChatId, nextTracking);
  }

  /**
   * Ensure a Ragflow model is available on Criadex before attempting chat.
   * Retries when 404 (model not found) for a short window.
   */
  private async ensureModelReady(
    modelId: number | string,
    maxRetries: number = 3,
    initialDelayMs: number = 500
  ): Promise<void> {
    const url = `${Config.CRIA_SERVER_URL}/models/ragflow/${modelId}/about`;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const resp: AxiosResponse = await this.get(url, {
          headers: { "x-api-key": Config.CRIA_SERVER_TOKEN },
          validateStatus: status => status < 500
        });

        if (resp.status === 200) {
          if (debugEnabled())
            console.log(`[EmbedService] Model ${modelId} exists on Criadex`);
          return;
        }

        if (resp.status === 404) {
          if (attempt < maxRetries - 1) {
            const wait = initialDelayMs * Math.pow(2, attempt);
            if (debugEnabled())
              console.log(
                `[EmbedService] Model ${modelId} not found on Criadex (attempt ${
                  attempt + 1
                }), retrying in ${wait}ms`
              );
            await new Promise(r => setTimeout(r, wait));
            continue;
          }

          if (debugEnabled())
            console.log(
              `[EmbedService] Model ${modelId} not found after ${maxRetries} attempts`
            );
          throw new CriaError(
            `Ragflow model ${modelId} not found on Criadex`,
            503
          );
        }

        // Any other status code treated as an upstream error
        throw new CriaError(
          `Unexpected response checking model on Criadex: ${resp.status}`,
          502
        );
      } catch (err: any) {
        // If we intentionally raised a CriaError (e.g. 503 for model missing), rethrow it as-is
        if (err instanceof CriaError) {
          throw err;
        }

        if (attempt < maxRetries - 1) {
          const wait = initialDelayMs * Math.pow(2, attempt);
          if (debugEnabled())
            console.log(
              `[EmbedService] Error when checking model readiness: ${
                err?.message || err
              }, retrying in ${wait}ms`
            );
          await new Promise(r => setTimeout(r, wait));
          continue;
        }

        if (debugEnabled())
          console.log(
            `[EmbedService] Error verifying model readiness: ${
              err?.message || err
            }`
          );
        throw new CriaError(
          `Failed to verify model readiness for ${modelId}: ${
            err?.message || "unknown"
          }`,
          502
        );
      }
    }
  }

  async retrieveEmbedConfig(
    chatId: string,
    botName: string
  ): Promise<EmbedPublicConfig> {
    const botConfig: IBotEmbed = await this.manageService.retrieveBot(
      botName,
      "",
      true
    );
    const botGreeting: string =
      botConfig.botGreeting || Config.DEFAULT_BOT_GREETING;
    const botGreetingId = "greeting";

    await this.ensureGreetingMessage(chatId, botGreeting);

    if (debugEnabled()) {
      console.log("Returning embed config for bot: " + botName, botConfig);
    }

    const config: EmbedPublicConfig = {
      botId: botConfig.botName,
      botName: botConfig.botTitle || botConfig.botName,
      botSubName: botConfig.botSubTitle,
      botGreeting: botGreeting,
      botGreetingId: botGreetingId,
      botIconUrl:
        botConfig.botIconUrl || Config.THIS_APP_URL + "/public/popup/cria.png",
      embedTheme: botConfig.botEmbedTheme || null,
      defaultEnabled: botConfig.botEmbedDefaultEnabled,
      embedPosition: botConfig.botEmbedPosition || EmbedPosition.BL,
      watermarkEnabled: botConfig.botWatermark,
      botLocale: botConfig.botLocale || "en-US",
      initialPrompts: botConfig.initialPrompts,
      botTrustWarning: botConfig.botTrustWarning || null,
      botContact: botConfig.botContact == null ? null : botConfig.botContact
    };

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

  public async transferTrackingInfo(previousChatId: string, newChatId: string) {
    const trackingData = await this.trackingCache.get(previousChatId);

    // Restarted chats should keep tracking metadata, but must not inherit
    // the previous Criabot chat mapping (that would continue the old conversation).
    const nextTrackingData: Record<string, any> = {
      ...(trackingData || {}),
      embedChatReady: true,
      restartedFromChatId: previousChatId
    };
    delete nextTrackingData.criabotChatId;

    await this.trackingCache.set(newChatId, nextTrackingData);
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
    const botConfig: IBotEmbed = await this.manageService.retrieveBot(
      botName,
      "",
      true
    );
    const chatId: string = await this.createChat();
    await this.ensureGreetingMessage(
      chatId,
      botConfig.botGreeting || Config.DEFAULT_BOT_GREETING
    );

    const popupConfig: EmbedPopupConfig = {
      // Chat needs
      chatId: chatId,
      chatApiUrl: Config.THIS_APP_URL,
      webAppUrl: Config.WEB_APP_URL,
      botId: botConfig.botName,

      // Popup needs
      botName: botConfig.botName,
      embedTheme: botConfig.botEmbedTheme || null,
      botIconUrl:
        botConfig.botIconUrl || Config.THIS_APP_URL + "/public/popup/cria.png",
      defaultEnabled: botConfig.botEmbedDefaultEnabled,
      embedPosition: botConfig.botEmbedPosition || EmbedPosition.BL,
      embedHoverTooltip: botConfig.embedHoverTooltip || null,
      hideLauncher: hideLauncher,
      inlineLauncher: inlineLauncher
    };

    const embedJs = EMBED_BASE_SCRIPT.replace(
      "$objectReplace",
      JSON.stringify(popupConfig)
    );

    return [embedJs, chatId];
  }

  async existsEmbedChat(chatId: string): Promise<boolean> {
    if (await this.messageCache.get(chatId, "greeting")) {
      return true;
    }

    const trackingData = await this.trackingCache.get(chatId);
    if (trackingData?.embedChatReady === true) {
      return true;
    }

    const mappedCriabotChatId = await this.getMappedCriabotChatId(chatId);
    const criabotChatId = mappedCriabotChatId || chatId;

    const response: AxiosResponse = await this.get(
      Config.CRIA_BOT_SERVER_URL +
        `/bots/chats/${criabotChatId}/exists?x-api-key=${Config.CRIA_BOT_SERVER_TOKEN}`
    );

    if (response.data.code !== "SUCCESS") {
      throw new CriaError("Error: " + JSON.stringify(response.data));
    }

    const exists: boolean | null | undefined = response.data.exists;

    if (exists === null || exists === undefined) {
      throw new CriaError(
        "Error: Response shows undefined exists. Payload read error?"
      );
    }

    return exists;
  }

  async sendEmbedChat(
    botName: string,
    chatId: string,
    prompt: string,
    fullResponse: boolean = false
  ): Promise<SendChatResponse | ExtendedSendChatResponse> {
    const history = [{ role: "user", content: prompt }];
    const apiResponse: CriaGetGPTResponseFunctionResponse = await this.sendChat(
      botName,
      chatId,
      prompt,
      history
    );
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
      };
    }

    if (!apiResponse.message) {
      throw new CriaError(
        "No response message was sent, likely due to an error."
      );
    }

    // Save ID for TTS
    const replyId: string | null = apiResponse.message
      ? await this.messageCache.set(
          chatId,
          parse(apiResponse.message).textContent
        )
      : null;

    const verifiedResponse: boolean | undefined =
      criaBotResponse?.reply?.verified_response;

    const responseData: SendChatResponse = {
      message: criaBotResponse.message || "Success!", // Message refers to the RESPONSE message
      status: 200,
      code: "SUCCESS",
      timestamp: Date.now().toString(),
      reply: apiResponse.message, // Reply refers to the CONTENT reply
      replyId: replyId,
      relatedPrompts: criaBotResponse?.reply?.related_prompts || null,
      verifiedResponse: verifiedResponse == null ? null : verifiedResponse
    };

    if (fullResponse) {
      return {
        ...responseData,
        fullResponse: apiResponse.criabot_response || undefined
      };
    }

    return responseData;
  }

  private async postCriabotChatStream(
    criabotChatId: string,
    canonicalBotName: string,
    prompt: string
  ): Promise<AxiosResponse> {
    const chatUrl = `${
      Config.CRIA_BOT_SERVER_URL
    }/bots/chats/${encodeURIComponent(criabotChatId)}/stream`;

    return this.post(
      chatUrl,
      {
        bot_name: canonicalBotName,
        prompt,
        extra_bots: []
      },
      {
        headers: {
          "x-api-key": Config.CRIA_BOT_SERVER_TOKEN,
          Accept: "text/event-stream"
        },
        responseType: "stream",
        validateStatus: status => status < 500
      }
    );
  }

  async streamEmbedChat(
    botName: string,
    chatId: string,
    prompt: string
  ): Promise<AxiosResponse> {
    const botConfig: IBotEmbed = await this.manageService.retrieveBot(
      botName,
      "",
      true
    );
    const canonicalBotName = botConfig.botName;

    try {
      let criabotChatId = await this.getMappedCriabotChatId(chatId);
      if (!criabotChatId) {
        criabotChatId = chatId;
      }

      const trackingData = await this.trackingCache.get(chatId);
      const criabotPrompt = buildEmbedCriabotPrompt(prompt, trackingData);

      let response = await this.postCriabotChatStream(
        criabotChatId,
        canonicalBotName,
        criabotPrompt
      );

      // If Criabot does not know this chat id yet, create one and retry once.
      if (response?.status === 404) {
        const startedChatId = await this.startCriabotChat();
        await this.setMappedCriabotChatId(chatId, startedChatId);
        criabotChatId = startedChatId;

        response = await this.postCriabotChatStream(
          criabotChatId,
          canonicalBotName,
          criabotPrompt
        );
      }

      return response;
    } catch (error: any) {
      if (debugEnabled()) {
        console.error(
          "[EmbedService] Criabot stream chat error:",
          error?.response?.status,
          error?.response?.data || error?.message
        );
      }

      const message = error?.response?.status
        ? `Criabot returned HTTP ${error.response.status}`
        : "Criabot service is temporarily unavailable. Please try again later.";

      throw new CriaError(message);
    }
  }
}
