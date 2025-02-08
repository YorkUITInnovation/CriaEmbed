import {Delete, Header, OperationId, Path, Route, Tags} from "tsoa";
import {BotNotFoundError, EmbedNotFoundError, ManageService, UnauthorizedError} from "../../services/ManageService";
import {BaseController} from "../../models/BaseController";
import {API_KEY_HEADER_NAME, CriaError, CriaResponse} from "../../models/CriaResponse";

interface DeleteResponse extends CriaResponse {
  botName?: string;
}

@Tags("Manage")
@Route("/manage/{botId}/delete")
@OperationId("manageDeleteBot")
export class DeleteController extends BaseController {

  constructor(
      public service: ManageService = new ManageService()
  ) {
    super();
  }

  @Delete()
  public async delete(
      @Path() botId: string,
      @Header(API_KEY_HEADER_NAME) apiKey: string
  ): Promise<DeleteResponse> {

    try {
      await this.service.deleteBot(botId, apiKey)
      this.setStatus(200);

      return {
        botName: botId,
        message: "Bot has been cast into the void.",
        status: 200,
        code: "SUCCESS",
        timestamp: Date.now().toString(),
      };

    } catch (e: any) {

      switch (e.constructor) {
        case CriaError:
          const payload: CriaResponse = e.payload;
          this.setStatus(payload.status);
          return payload;
        case EmbedNotFoundError:
          this.setStatus(404, e);
          return {
            timestamp: Date.now().toString(),
            status: 404,
            message: "That bot embed does not exist.",
            botName: botId,
            code: "NOT_FOUND"
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
