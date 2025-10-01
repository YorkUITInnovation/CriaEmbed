import {BaseService} from "./BaseService";
import {BotEmbed, IBotEmbed, IBotEmbedConfig} from "../database/mysql/controllers/BotEmbed";
import {CriaError} from "../models/CriaResponse";
import {AxiosResponse} from "axios";
import {Config as GlobalConfig} from "../config";


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
  private db: BotEmbed;
  private config: typeof GlobalConfig;

  constructor(pool: import('mysql2').Pool, config?: typeof GlobalConfig) {
    super(pool);
    this.db = new BotEmbed(pool);
    this.config = config || GlobalConfig;
  }

  public async botExistsAndIsAuthorized(botName: string, apiKey: string): Promise<true> {
    const botExistsResponse: AxiosResponse = await super.get(
      `${this.config.CRIA_BOT_SERVER_URL}/groups/${botName}/about`,
      { headers: { 'x-api-key': this.config.CRIA_BOT_SERVER_TOKEN } }
    );

    if (botExistsResponse.status === 404) {
      throw new BotNotFoundError();
    }

    const authCheckResponse: AxiosResponse = await super.get(
      `${this.config.CRIA_BOT_SERVER_URL}/auth/${apiKey}/check`,
      { headers: { 'x-api-key': this.config.CRIA_BOT_SERVER_TOKEN } }
    );

    if (authCheckResponse.data.authorized === false) {
      throw new UnauthorizedError();
    }

    return true;
  }

  async existsBot(botName: string): Promise<boolean> {
    const result: IBotEmbed | undefined = await this.db.retrieveByName(botName);
    return !!result;
  }

  async retrieveBot(name: string, apiKey: string, skipAuth: boolean = false): Promise<IBotEmbed> {
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
    await this.botExistsAndIsAuthorized(config.botName, apiKey);
    if (await this.db.existsByName(config.botName)) {
      throw new DuplicateEmbedError();
    }
    return await this.db.insert(config);
  }

  async deleteBot(botName: string, apiKey: string): Promise<number> {
    await this.botExistsAndIsAuthorized(botName, apiKey);
    if (!await this.db.existsByName(botName)) {
      throw new EmbedNotFoundError();
    }
    return await this.db.removeByName(botName);
  }

  async updateBot(config: IBotEmbedConfig, apiKey: string): Promise<IBotEmbed> {
    await this.botExistsAndIsAuthorized(config.botName, apiKey);
    const result: IBotEmbed | undefined = await this.db.update(config);
    if (!result) {
      throw new EmbedNotFoundError();
    }
    return result;
  }
}
