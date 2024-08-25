import {Example, Get, Middlewares, Path, Produces, Request, Route, Tags} from "tsoa";
import {EmbedNotFoundError} from "../../services/ManageService";
import {BaseController} from "../../models/BaseController";
import {EmbedService} from "../../services/EmbedService";
import {CriaError, CriaResponse} from "../../models/CriaResponse";
import {RATE_LIMIT_EMBED_ALL_HANDLERS} from "../../models/LimitGenerator";
import express from "express";

@Tags("Embed")
@Route("/embed/{botName}/load")
export class EmbedController extends BaseController {

    constructor(
        public service: EmbedService = new EmbedService()
    ) {
        super();
    }

    @Get()
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
    public async load(
        @Request() request: express.Request,
        @Path() botName: string
    ): Promise<string | CriaResponse> {

        try {
            const embed: string = await this.service.retrieveEmbed(
                botName
            );

            this.setStatus(200);

            this.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            this.setHeader("Pragma", "no-cache");
            this.setHeader("Expires", "0");

            // Tsoa plaintext is broken, we gotta hack it
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
