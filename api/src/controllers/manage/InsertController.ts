import {Body, Header, OperationId, Path, Post, Route, Tags} from "tsoa";
import {BotNotFoundError, DuplicateEmbedError, ManageService, UnauthorizedError} from "../../services/ManageService";
import {BaseController} from "../../models/BaseController";

import {IBotBaseEmbedConfig, IBotEmbed} from "../../database/mysql/controllers/BotEmbed";
import {API_KEY_HEADER_NAME, CriaError, CriaResponse} from "../../models/CriaResponse";

interface InsertResponse extends CriaResponse {
  config?: IBotEmbed
}


@Tags("Manage")
@Route("manage/{botId}/insert")
@OperationId("manageInsertBot")
export class InsertController extends BaseController {

  constructor(
      public service: ManageService = new ManageService(),
  ) {
    super();
  }

  @Post()
  public async insert(
      @Path() botId: string,
      @Body() config: IBotBaseEmbedConfig,
      @Header(API_KEY_HEADER_NAME) apiKey: string
  ): Promise<InsertResponse> {

    try {
      const botConfig: IBotEmbed = await this.service.insertBot(
          {...config, botName: botId},
          apiKey
      )
      this.setStatus(200);

      return {
        config: botConfig,
        message: "Successfully inserted config",
        status: 200,
        code: "SUCCESS",
        timestamp: Date.now().toString()
      };

    } catch (e: any) {

      switch (e.constructor) {
        case CriaError:
          const payload: CriaResponse = e.payload;
          this.setStatus(payload.status, e);
          return payload;
        case DuplicateEmbedError:
          this.setStatus(409, e);
          return {
            message: "That bot config already exists!",
            status: 409,
            code: "DUPLICATE",
            timestamp: Date.now().toString()
          };
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
            message: `Internal error occurred! Error Class: '${e.constructor.name}'`,
            code: "ERROR"
          };
      }

    }

  }

}
