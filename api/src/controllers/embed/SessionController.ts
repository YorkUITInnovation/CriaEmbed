import {Get, Header, Path, Query, Route, Tags} from "tsoa";
import {BaseController} from "../../models/BaseController";
import {EmbedService} from "../../services/EmbedService";
import {API_KEY_HEADER_NAME, CriaResponse} from "../../models/CriaResponse";
import {BotNotFoundError, UnauthorizedError} from "../../services/ManageService";

interface SessionDataResponse extends CriaResponse {
  sessionData: Record<string, any> | null
}

@Tags("Sessions")
@Route("/embed/{botId}/session_data")
export class SessionController extends BaseController {

  constructor(
      public service: EmbedService = new EmbedService()
  ) {
    super();
  }

  @Get()
  public async getSessionData(
      @Path() botId: string,
      @Header(API_KEY_HEADER_NAME) apiKey: string,
      @Query() chatId: string
  ): Promise<string | SessionDataResponse> {

    try {
      const trackingData = await this.service.getTrackingInfo(
          botId,
          chatId,
          apiKey
      );

      if (trackingData === null) {
        this.setStatus(404);
        return {
          status: 404,
          timestamp: Date.now().toString(),
          code: "NOT_FOUND",
          message: "No session data found (does the chat exist? was it made with the POST request variant?)!",
          sessionData: null
        }
      }

      return {
        status: 200,
        timestamp: Date.now().toString(),
        code: "SUCCESS",
        message: "Successfully retrieved session data!",
        sessionData: trackingData
      }

    } catch (e) {
      switch (e.constructor) {
        case BotNotFoundError:
          this.setStatus(404, e)
          return {
            message: "That bot does not exist.",
            status: 404,
            code: "NOT_FOUND",
            timestamp: Date.now().toString(),
            sessionData: null
          }
        case UnauthorizedError:
          this.setStatus(403, e);
          return {
            message: "Your key is not authorized for this action.",
            status: 403,
            code: "UNAUTHORIZED",
            timestamp: Date.now().toString(),
            sessionData: null
          }
        default:
          this.setStatus(500, e);
          return {
            timestamp: Date.now().toString(),
            status: 500,
            code: "ERROR",
            message: "Error creating an embed!",
            sessionData: null
          };
      }
    }


  }


}
