import {Body, Example, Get, Header, Middlewares, Path, Post, Produces, Query, Request, Route, Tags} from "tsoa";
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
  /**
   * Upsert an embedding into Elasticsearch
   */
  @Post("/embedding/upsert")
  @Tags("Embed")
  public async upsertEmbedding(
    @Body() body: { id: string, embedding: number[], metadata: Record<string, any> }
  ): Promise<CriaResponse> {
    await this.service.upsertEmbedding(body.id, body.embedding, body.metadata);
    this.setStatus(200);
    return {
      status: 200,
      timestamp: Date.now().toString(),
      code: "SUCCESS",
      message: "Embedding upserted successfully"
    };
  }

  /**
   * Semantic search for embeddings in Elasticsearch
   */
  @Post("/embedding/search")
  @Tags("Embed")
  public async searchEmbeddings(
    @Body() body: { queryEmbedding: number[], k?: number }
  ): Promise<{ results: any[] }> {
    const results = await this.service.searchEmbeddings(body.queryEmbedding, body.k || 10);
    this.setStatus(200);
    return { results };
  }

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
  public async getLoadEmbed(
      @Request() request: e.Request,
      @Path() botId: string,
      @Query() hideLauncher: boolean = false,
      @Query() inlineLauncher: boolean = false
  ): Promise<string | CriaResponse> {
    return await this.loadEmbed(request, botId, hideLauncher, inlineLauncher);
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
      @Query() hideLauncher: boolean = false,
      @Query() inline: boolean = false
  ): Promise<string | CriaResponse> {
    return await this.loadEmbed(request, botId, hideLauncher, inline, sessionData, apiKey);
  }

  private async loadEmbed(
      request: e.Request,
      botId: string,
      hideLauncher: boolean,
      inlineLauncher: boolean = false,
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

      if (inlineLauncher && hideLauncher) {
        return {
          timestamp: Date.now().toString(),
          status: 400,
          code: "UNAUTHORIZED",
          message: "You cannot hide the launcher in inline mode, as there is no launcher to hide."
        };
      }

      const [embed, chatId] = await this.service.retrieveEmbed(
          botId, hideLauncher, inlineLauncher
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
