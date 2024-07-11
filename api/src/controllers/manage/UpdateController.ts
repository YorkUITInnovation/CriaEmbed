import {Body, Header, Patch, Path, Route, Tags} from "tsoa";
import {BotNotFoundError, EmbedNotFoundError, ManageService, UnauthorizedError} from "../../services/ManageService";
import {BaseController} from "../../models/BaseController";

import {IBotBaseEmbedConfig, IBotEmbed} from "../../database/mysql/controllers/BotEmbed";
import {API_KEY_HEADER_NAME, CriaError, CriaResponse} from "../../models/CriaResponse";

interface UpdateResponse extends CriaResponse {
    config?: IBotEmbed
}


@Tags("Manage")
@Route("manage/{botName}/config")
export class UpdateController extends BaseController {

    constructor(
        public service: ManageService = new ManageService(),
    ) {
        super();
    }

    @Patch()
    public async update(
        @Path() botName: string,
        @Body() config: IBotBaseEmbedConfig,
        @Header(API_KEY_HEADER_NAME) apiKey: string
    ): Promise<UpdateResponse> {

        try {
            const botConfig: IBotEmbed = await this.service.updateBot(
                {...config, botName: botName},
                apiKey
            )
            this.setStatus(200);

            return {
                config: botConfig,
                message: "Successfully updated config",
                status: 200,
                code: "SUCCESS",
                timestamp: Date.now().toString()
            };

        } catch (e: any) {

            switch (e.constructor) {
                case CriaError:
                    const payload: CriaResponse = e.payload;
                    this.setStatus(payload.status);
                    return payload;
                case EmbedNotFoundError:
                    this.setStatus(404);
                    return {
                        message: "That bot config could not be found!",
                        status: 404,
                        code: "NOT_FOUND",
                        timestamp: Date.now().toString()
                    };
                case BotNotFoundError:
                    this.setStatus(404)
                    return {
                        message: "That bot does not exist.",
                        status: 404,
                        code: "NOT_FOUND",
                        timestamp: Date.now().toString()
                    }
                case UnauthorizedError:
                    return {
                        message: "Your key is not authorized for this action.",
                        status: 404,
                        code: "UNAUTHORIZED",
                        timestamp: Date.now().toString()
                    }
                default:
                    this.setStatus(500);
                    console.error(e);
                    return {
                        timestamp: Date.now().toString(),
                        status: 500,
                        message: `Internal error occurred! Class: '${e.constructor.name}'`,
                        code: "ERROR"
                    };
            }

        }

    }

}
