import {Get, Middlewares, Path, Route, Tags} from "tsoa";
import {BaseController} from "../../models/BaseController";
import {EmbedService} from "../../services/EmbedService";
import {CriaError, CriaResponse, ExistsChatResponse} from "../../models/CriaResponse";
import {RATE_LIMIT_CHAT_ALL_HANDLERS} from "../../models/LimitGenerator";


@Tags("Chats")
@Route("/chats/{chatId}/exists")
export class ChatExistsController extends BaseController {

    constructor(
        public service: EmbedService = new EmbedService()
    ) {
        super();
    }

    @Get()
    @Middlewares(...RATE_LIMIT_CHAT_ALL_HANDLERS)
    public async exists(
        @Path() chatId: string,
    ): Promise<ExistsChatResponse> {

        try {
            const exists: boolean | null = await this.service.existsEmbedChat(chatId);
            this.setStatus(200);

            return {
                timestamp: Date.now().toString(),
                status: 404,
                code: "SUCCESS",
                message: "Retrieved chat status!",
                exists: exists
            };

        } catch (e: any) {
            switch (e.constructor) {
                case CriaError:
                    this.setStatus(e.payload.status);
                    return {exists: null, ...(e.payload as CriaResponse)};
                default:
                    this.setStatus(500);
                    return {
                        timestamp: Date.now().toString(),
                        status: 500,
                        code: "ERROR",
                        message: "Error checking the status of the chat!",
                        exists: null
                    };
            }

        }

    }

}
