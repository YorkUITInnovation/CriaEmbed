import {
  Body,
  Example,
  Get,
  Header,
  Middlewares,
  OperationId,
  Path,
  Post,
  Produces,
  Query,
  Request,
  Route,
  Tags
} from "tsoa";
import {BotNotFoundError, EmbedNotFoundError, UnauthorizedError} from "../../services/ManageService";
import {BaseController} from "../../models/BaseController";
import {EmbedService} from "../../services/EmbedService";
import {API_KEY_HEADER_NAME, CriaError, CriaResponse} from "../../models/CriaResponse";
import {RATE_LIMIT_EMBED_ALL_HANDLERS} from "../../models/LimitGenerator";
import e from "express";

interface EmbedBody {
  [key: string]: any;
}


@Route("/embed/{botId}/load")
export class EmbedController extends BaseController {

  constructor(
      public service: EmbedService = new EmbedService()
  ) {
    super();
  }

  @Get()
  @Tags("Embed")
  @Example<string>(
      "(async function(){console.log('Cria load script')})()", "SUCCESS",
  )
  @Example<CriaResponse>(
      {
        status: 500,
        timestamp: "string",
        message: "string",
        code: "ERROR"
      }, "NOT SUCCESS"
  )
  @Produces("application/javascript")
  @Middlewares(...RATE_LIMIT_EMBED_ALL_HANDLERS)
  @OperationId("embedGetLoader")
  public async getLoadEmbed(
      @Request() request: e.Request,
      @Path() botId: string,
      @Query() hideLauncher: boolean = false
  ): Promise<string | CriaResponse> {
    return await this.loadEmbed(request, botId, hideLauncher);
  }

  @Tags("Sessions")
  @Post()
  @Example<string>(
      "(async function(){console.log('Cria load script')})()", "SUCCESS",
  )
  @Example<CriaResponse>(
      {
        status: 500,
        timestamp: "string",
        message: "string",
        code: "ERROR"
      }, "NOT SUCCESS"
  )
  @Produces("application/javascript")
  @Middlewares(...RATE_LIMIT_EMBED_ALL_HANDLERS)
  public async postLoadEmbed(
      @Request() request: e.Request,
      @Path() botId: string,
      @Header(API_KEY_HEADER_NAME) apiKey: string,
      @Body() sessionData: EmbedBody,
      @Query() hideLauncher: boolean = false
  ): Promise<string | CriaResponse> {
    return await this.loadEmbed(request, botId, hideLauncher, sessionData, apiKey);
  }

  private async loadEmbed(
      request: e.Request,
      botId: string,
      hideLauncher: boolean,
      sessionData?: Record<string, any>,
      apiKey?: string,
  ): Promise<string | CriaResponse> {
    try {

      if (sessionData && !apiKey) {
        return {
          timestamp: Date.now().toString(),
          status: 401,
          code: "UNAUTHORIZED",
          message: "You must provide an API key to send session data."
        };
      }

      const [embed, chatId] = await this.service.retrieveEmbed(
          botId, hideLauncher
      );

      if (sessionData && apiKey) {
        await this.service.saveTrackingInfo(
            botId,
            chatId,
            sessionData,
            apiKey
        );
      }

      this.setStatus(200);

      this.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      this.setHeader("Pragma", "no-cache");
      this.setHeader("Expires", "0");

      // Tsoa plaintext is broken, we gotta hack it
      request.res?.setHeader("X-Chat-Id", chatId);
      request.res?.setHeader("Content-Type", "application/javascript; charset=utf-8")
      request.res?.send(embed);
      return "";

    } catch (e: any) {

      switch (e.constructor) {
        case EmbedNotFoundError:
          this.setStatus(404, e);

          return {
            timestamp: Date.now().toString(),
            status: 404,
            code: "NOT_FOUND",
            message: "The requested bot does NOT have embeds enabled or does not exist."
          };

        case CriaError:
          const payload: CriaResponse = e.payload;
          this.setStatus(payload.status, e);
          return payload;
        case BotNotFoundError:
          this.setStatus(404, e)
          return {
            message: "That bot does not exist.",
            status: 404,
            code: "NOT_FOUND",
            timestamp: Date.now().toString()
          }
        case UnauthorizedError:
          this.setStatus(403, e);
          return {
            message: "Your key is not authorized for this action.",
            status: 403,
            code: "UNAUTHORIZED",
            timestamp: Date.now().toString()
          }
        default:
          this.setStatus(500, e);
          return {
            timestamp: Date.now().toString(),
            status: 500,
            code: "ERROR",
            message: "Error creating an embed!"
          };
      }

    }

  }


}
