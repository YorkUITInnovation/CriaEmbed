import {BaseService} from "./BaseService";
import {ActivityHandler, TurnContext} from "botbuilder";
import {EmbedService} from "./EmbedService";
import {createCloudAdapter, getActivityHandler, MissingAzureAuthenticationError} from "./azureBots/tools";
import e from "express";
import AzureChatCache from "../database/redis/controllers/AzureChatCache";


export class AzureService extends BaseService {

  constructor(
      private embedService: EmbedService,
      private chatCache: AzureChatCache = new AzureChatCache()
  ) {
    super();
  }

  private getAppIdFromJwt(jwt: string): string {
    const [_, jwtBody, __] = jwt.split(".");
    const buff = Buffer.from(jwtBody, 'base64');
    return JSON.parse(buff.toString('utf-8')).aud;
  }

  async handleRequest(req: e.Request, res: e.Response): Promise<void> {
    const microsoftBotId: string = this.getAppIdFromJwt(req.headers.authorization as string);
    const embedBot = await this.embedService.manageService.retrieveBotByMicrosoftAppId(microsoftBotId);

    if (!(embedBot.microsoftAppPassword && embedBot.microsoftAppId)) {
      throw new MissingAzureAuthenticationError("Microsoft App ID or Password not found in Bot config.");
    }

    // Grabs the correct ActivityHandler for the bot & its channel
    const activityHandler: ActivityHandler = getActivityHandler(
        embedBot,
        this.embedService,
        this.chatCache
    );

    // Creates a cloud adapter for the incoming request
    const adapter = createCloudAdapter(
        embedBot.microsoftAppId,
        embedBot.microsoftAppPassword,
    );

    // Processes the request
    await adapter.process(req, res, (ctx: TurnContext) => activityHandler.run(ctx))

  }

}