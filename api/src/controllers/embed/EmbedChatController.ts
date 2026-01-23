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
@Route("/embed/{botId}/send")
export class EmbedChatController extends BaseController {

    constructor(
        public service: EmbedService = new EmbedService()
    ) {
        super();
    }

    @Post()
    @Middlewares(...RATE_LIMIT_CHAT_ALL_HANDLERS)
    public async send(
        @Path() botId: string,
        @Body() config: ChatPayload,
    ): Promise<SendChatResponse> {

        // Basic input validation to avoid malformed or abusive requests
        if (!botId || botId.trim().length === 0) {
            throw new CriaError("Invalid botId provided.");
        }

        if (!config?.chatId || config.chatId.trim().length === 0) {
            throw new CriaError("chatId is required.");
        }

        const prompt: string = config?.prompt ?? "";
        if (prompt.trim().length === 0) {
            throw new CriaError("prompt must not be empty.");
        }

        // Protect against excessively large prompts
        const MAX_PROMPT_LENGTH = 4000;
        if (prompt.length > MAX_PROMPT_LENGTH) {
            throw new CriaError(`prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters.`);
        }

        try {
            const chat: SendChatResponse = await this.service.sendEmbedChat(
                botId,
                config.chatId,
                prompt
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
