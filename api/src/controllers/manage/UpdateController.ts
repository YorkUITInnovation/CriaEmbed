import {Body, Header, Patch, Path, Route, Tags} from "tsoa";
import {BotNotFoundError, EmbedNotFoundError, ManageService, UnauthorizedError} from "../../services/ManageService.js";
import {BaseController} from "../../models/BaseController.js";

import type {IBotBaseEmbedConfig, IBotEmbed} from "../../database/mysql/controllers/BotEmbed.js";
import {API_KEY_HEADER_NAME, CriaError, CriaResponse} from "../../models/CriaResponse.js";
import {getMySQLPool} from "../../database/mysql/pool.js";

interface UpdateResponse extends CriaResponse {
    config?: IBotEmbed
}


@Tags("Manage")
@Route("manage/{botId}/config")
export class UpdateController extends BaseController {

    constructor(
    pool?: import('mysql2').Pool,
    public service: ManageService = new ManageService(pool || getMySQLPool()),
    ) {
        super();
    }

    @Patch()
    public async update(
        @Path() botId: string,
        @Body() config: IBotBaseEmbedConfig,
        @Header(API_KEY_HEADER_NAME) apiKey: string
    ): Promise<UpdateResponse> {

        try {
            const botConfig: IBotEmbed = await this.service.updateBot(
                {...config, botName: botId},
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
                    console.error(`[UpdateController] Unexpected error:`, e);
                    console.error(`[UpdateController] Error stack:`, e.stack);
                    this.setStatus(500, e);
                    return {
                        timestamp: Date.now().toString(),
                        status: 500,
                        message: `Internal error occurred! Class: '${e.constructor.name}', Message: '${e.message || 'Unknown error'}'`,
                        code: "ERROR"
                    };
            }

        }

    }

}
