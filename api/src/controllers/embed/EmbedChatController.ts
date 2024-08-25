import {Body, Middlewares, Path, Post, Route, Tags} from "tsoa";
import {EmbedNotFoundError} from "../../services/ManageService";
import {BaseController} from "../../models/BaseController";
import {EmbedService} from "../../services/EmbedService";
import {CriaError, CriaResponse, SendChatResponse} from "../../models/CriaResponse";
import {RATE_LIMIT_CHAT_ALL_HANDLERS} from "../../models/LimitGenerator";

type ChatPayload = {
    chatId: string,
    prompt: string
}


@Tags("Embed")
@Route("/embed/{botName}/send")
export class EmbedChatController extends BaseController {

    constructor(
        public service: EmbedService = new EmbedService()
    ) {
        super();
    }

    @Post()
    @Middlewares(...RATE_LIMIT_CHAT_ALL_HANDLERS)
    public async send(
        @Path() botName: string,
        @Body() config: ChatPayload,
    ): Promise<SendChatResponse> {

        try {
            const chat: SendChatResponse = await this.service.sendEmbedChat(
                botName,
                config.chatId,
                config.prompt
            )
            this.setStatus(200);
            return chat;
        } catch (e: any) {
            switch (e.constructor) {
                case EmbedNotFoundError:
                    this.setStatus(404, e);
                    return {
                        timestamp: Date.now().toString(),
                        status: 404,
                        code: "NOT_FOUND",
                        message: "The requested bot does NOT have embeds enabled or does not exist.",
                        reply: null,
                        replyId: null,
                        relatedPrompts: null,
                        verifiedResponse: null
                    };
                case CriaError:
                    const payload: CriaResponse = e.payload;
                    this.setStatus(payload.status, e);
                    return {
                        reply: null,
                        replyId: null,
                        relatedPrompts: null,
                        verifiedResponse: null,
                        ...payload
                    };
                default:
                    this.setStatus(500, e);
                    return {
                        timestamp: Date.now().toString(),
                        status: 500,
                        code: "ERROR",
                        message: "Error sending a chat due to an error: " + e.message,
                        reply: null,
                        replyId: null,
                        relatedPrompts: null,
                        verifiedResponse: null
                    };
            }

        }

    }

}
