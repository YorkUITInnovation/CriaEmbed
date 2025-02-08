import {Get, OperationId, Path, Query, Route, Tags} from "tsoa";
import {EmbedNotFoundError} from "../../services/ManageService";
import {BaseController} from "../../models/BaseController";
import {EmbedPublicConfig, EmbedService} from "../../services/EmbedService";
import {CriaError, CriaResponse, EmbedConfigResponse} from "../../models/CriaResponse";

@Tags("Embed")
@Route("/embed/{botId}/config")
export class EmbedConfigController extends BaseController {

  constructor(
      public service: EmbedService = new EmbedService()
  ) {
    super();
  }

  @Get()
  @OperationId("embedGetConfig")
  public async retrieveConfig(
      @Path() botId: string,
      @Query() chatId: string,
  ): Promise<EmbedConfigResponse> {

    if (!await this.service.existsEmbedChat(chatId)) {
      this.setStatus(404);
      return {
        timestamp: Date.now().toString(),
        status: 404,
        code: "NOT_FOUND",
        message: "The requested chat does NOT exist.",
      };
    }

    try {
      const config: EmbedPublicConfig = await this.service.retrieveEmbedConfig(
          chatId,
          botId
      );
      this.setStatus(200);
      return {
        timestamp: Date.now().toString(),
        status: 200,
        code: "SUCCESS",
        message: "Successfully retrieved embed config!",
        config: config
      };
    } catch (e: any) {
      switch (e.constructor) {
        case EmbedNotFoundError:
          this.setStatus(404, e);
          return {
            timestamp: Date.now().toString(),
            status: 404,
            code: "NOT_FOUND",
            message: "The requested bot does NOT have embeds enabled or does not exist.",
          };
        case CriaError:
          const payload: CriaResponse = e.payload;
          this.setStatus(payload.status, e);
          return {
            ...payload
          };
        default:
          this.setStatus(500, e);
          return {
            timestamp: Date.now().toString(),
            status: 500,
            code: "ERROR",
            message: "Error receiving config!",
          };
      }

    }

  }

}
