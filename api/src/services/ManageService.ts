import {BaseService} from "./BaseService";
import {BotEmbed, IBotEmbed, IBotEmbedConfig} from "../database/mysql/controllers/BotEmbed";
import {CriaError} from "../models/CriaResponse";
import {AxiosResponse} from "axios";


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

  constructor() {
    super();
    this.db = new BotEmbed(this.mySqlPool);
  }

  private async botExistsAndIsAuthorized(botName: string, apiKey: string): Promise<true> {
    const params: CriaBotExistsFunctionParams = {bot_id: botName, bot_api_key: apiKey};

    const response: AxiosResponse = await this.get(
        this.buildServiceURL(
            "cria_bot_exists", params
        )
    );

    console.log('response', response.data, typeof response.data)
    response.data = parseInt(response.data);

    switch (response.data) {
      case 404:
        throw new BotNotFoundError();
      case 401:
        throw new UnauthorizedError();
      case 200:
        return true;
      default:
        throw new CriaError(
            `Received unexpected response from 'cria_bot_exists' function: '${JSON.stringify(response.data)}'.`
        );
    }

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

    console.log('microsoftAppId', microsoftAppId)
    let result: IBotEmbed | undefined;
    try {
      result = await this.db.retrieveByAppId(microsoftAppId);
    } catch (e) {
      throw e
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
