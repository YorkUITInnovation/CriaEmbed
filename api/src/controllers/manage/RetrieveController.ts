import {Get, Header, OperationId, Path, Route, Tags} from "tsoa";
import {BotNotFoundError, EmbedNotFoundError, ManageService, UnauthorizedError} from "../../services/ManageService";
import {BaseController} from "../../models/BaseController";

import {IBotEmbed} from "../../database/mysql/controllers/BotEmbed";
import {API_KEY_HEADER_NAME, CriaError, CriaResponse} from "../../models/CriaResponse";
import {debugEnabled} from "../../config";

interface RetrieveResponse extends CriaResponse {
    config?: IBotEmbed
}

@Tags("Manage")
@Route("manage/{botId}/config")
@OperationId("manageGetBotConfig")
export class RetrieveController extends BaseController {

    constructor(
        public service: ManageService = new ManageService(),
    ) {
        super();
    }

    @Get()
    public async retrieve(
        @Path() botId: string,
        @Header(API_KEY_HEADER_NAME) apiKey: string
    ): Promise<RetrieveResponse> {

        try {
            const botConfig: IBotEmbed = await this.service.retrieveBot(botId, apiKey)
            this.setStatus(200);

            return {
                config: botConfig,
                message: "Successfully retrieved config",
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
                case EmbedNotFoundError:
                    this.setStatus(404, e);
                    return {
                        message: "That bot config could not be found!",
                        status: 404,
                        code: "NOT_FOUND",
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
                    if (debugEnabled()) {
                        console.error("Error occurred retrieving embed config!", e.stack);
                    }

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
