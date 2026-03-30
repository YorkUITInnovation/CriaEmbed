import {BaseService} from "./BaseService.js";
import {BotEmbed, IBotEmbed, IBotEmbedConfig} from "../database/mysql/controllers/BotEmbed.js";
import {CriaError} from "../models/CriaResponse.js";
import {AxiosResponse, AxiosError} from "axios";
import {Config as GlobalConfig} from "../config.js";


export class DuplicateEmbedError extends Error {
}

export class EmbedNotFoundError extends Error {
}

export class BotNotFoundError extends Error {
}

export class UnauthorizedError extends Error {
}

export type CriaBotExistsFunctionParams = {
  bot_id: string,
  bot_api_key: string
}

// Q33BRKoVYQKNGZNNbDEm14i90ZLDyL3hJsWnTIRoqPE

export class ManageService extends BaseService {
  private db?: BotEmbed;
  private config: typeof GlobalConfig;

  constructor(pool?: import('mysql2').Pool, config?: typeof GlobalConfig) {
    super(pool);
    if (pool) {
      this.db = new BotEmbed(pool);
      console.log('[ManageService] Initialized with database pool');
    } else {
      console.error('[ManageService] WARNING: Initialized without database pool!');
    }
    this.config = config || GlobalConfig;
  }

  public async botExistsAndIsAuthorized(botName: string, apiKey: string): Promise<true> {
    try {
      const botExistsResponse: AxiosResponse = await super.get(
        `${this.config.CRIA_BOT_SERVER_URL}/bots/${botName}/manage/about`,
        { 
          headers: { 'x-api-key': this.config.CRIA_BOT_SERVER_TOKEN },
          validateStatus: (status) => status < 500 // Don't throw on 4xx, only 5xx
        }
      );

      if (botExistsResponse.status === 404) {
        throw new BotNotFoundError();
      }

      if (botExistsResponse.status !== 200) {
        console.error(`[ManageService] Unexpected bot exists response: status=${botExistsResponse.status}, data=${JSON.stringify(botExistsResponse.data)}`);
        throw new CriaError(`Bot service returned status ${botExistsResponse.status} for bot '${botName}'`);
      }

      const authCheckResponse: AxiosResponse = await super.get(
        `${this.config.CRIA_SERVER_URL}/auth/${apiKey}/check`,
        { 
          headers: { 'x-api-key': this.config.CRIA_BOT_SERVER_TOKEN },
          validateStatus: (status) => status < 500 // Don't throw on 4xx, only 5xx
        }
      );

      if (authCheckResponse.status === 404 || authCheckResponse.data?.authorized === false) {
        throw new UnauthorizedError();
      }

      if (authCheckResponse.status !== 200) {
        throw new CriaError(`Auth check returned status ${authCheckResponse.status}`);
      }

      return true;
    } catch (e: any) {
      // If it's already a known error type, rethrow it
      if (e instanceof BotNotFoundError || e instanceof UnauthorizedError || e instanceof CriaError) {
        throw e;
      }
      
      // Handle AxiosError - check if it's a 404
      if (e.isAxiosError && e.response?.status === 404) {
        // Check which endpoint returned 404
        const url = e.config?.url || e.request?.path || '';
        if (url.includes('/groups/') && url.includes('/about')) {
          throw new BotNotFoundError();
        } else if (url.includes('/auth/')) {
          throw new UnauthorizedError();
        }
      }
      
      console.error(`[ManageService] Error in botExistsAndIsAuthorized for bot '${botName}':`, e.message);
      console.error(`[ManageService] Error stack:`, e.stack);
      throw e;
    }
  }

  async existsBot(botName: string): Promise<boolean> {
    if (!this.db) {
      console.error("ManageService: Database not initialized. Pool was not provided.");
      throw new Error("Database not initialized");
    }
    const result: IBotEmbed | undefined = await this.db.retrieveByName(botName);
    return !!result;
  }

  async retrieveBot(name: string, apiKey: string, skipAuth: boolean = false): Promise<IBotEmbed> {
    if (!this.db) {
      console.error("ManageService: Database not initialized. Pool was not provided.");
      throw new Error("Database not initialized");
    }
    if (!skipAuth) {
      await this.botExistsAndIsAuthorized(name, apiKey);
    }
    const result: IBotEmbed | undefined = await this.db.retrieveByName(name);
    if (!result) {
      throw new EmbedNotFoundError("Bot not found.");
    }
    return result;
  }

  async retrieveBotByMicrosoftAppId(microsoftAppId: string): Promise<IBotEmbed> {
    if (!this.db) {
      console.error("ManageService: Database not initialized. Pool was not provided.");
      throw new Error("Database not initialized");
    }
    let result: IBotEmbed | undefined;
    try {
      result = await this.db.retrieveByAppId(microsoftAppId);
    } catch (e) {
      throw e;
    }
    if (!result) {
      throw new EmbedNotFoundError();
    }
    return result;
  }

  async insertBot(config: IBotEmbedConfig, apiKey: string): Promise<IBotEmbed> {
    if (!this.db) {
      console.error("ManageService: Database not initialized. Pool was not provided.");
      throw new Error("Database not initialized");
    }
    await this.botExistsAndIsAuthorized(config.botName, apiKey);
    if (await this.db.existsByName(config.botName)) {
      throw new DuplicateEmbedError();
    }
    return await this.db.insert(config);
  }

  async deleteBot(botName: string, apiKey: string): Promise<number> {
    if (!this.db) {
      console.error("ManageService: Database not initialized. Pool was not provided.");
      throw new Error("Database not initialized");
    }
    await this.botExistsAndIsAuthorized(botName, apiKey);
    if (!await this.db.existsByName(botName)) {
      throw new EmbedNotFoundError();
    }
    return await this.db.removeByName(botName);
  }

  async updateBot(config: IBotEmbedConfig, apiKey: string): Promise<IBotEmbed> {
    if (!this.db) {
      console.error("ManageService: Database not initialized. Pool was not provided.");
      throw new Error("Database not initialized");
    }
    await this.botExistsAndIsAuthorized(config.botName, apiKey);
    const result: IBotEmbed | undefined = await this.db.update(config);
    if (!result) {
      throw new EmbedNotFoundError();
    }
    return result;
  }
}
