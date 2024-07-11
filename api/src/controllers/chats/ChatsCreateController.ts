import {Middlewares, Post, Route, Tags} from "tsoa";
import {BaseController} from "../../models/BaseController";
import {EmbedService} from "../../services/EmbedService";
import {CreateChatResponse, CriaError, CriaResponse} from "../../models/CriaResponse";
import {RATE_LIMIT_CHAT_ALL_HANDLERS} from "../../models/LimitGenerator";


@Tags("Chats")
@Route("/chats/{chatId}/create")
export class ChatsCreateController extends BaseController {

    constructor(
        public service: EmbedService = new EmbedService()
    ) {
        super();
    }

    @Post()
    @Middlewares(...RATE_LIMIT_CHAT_ALL_HANDLERS)
    public async create(): Promise<CreateChatResponse> {

        try {
            const chatId: string = await this.service.createChat();

            return {
                timestamp: Date.now().toString(),
                status: 404,
                code: "SUCCESS",
                message: "Created a chat!",
                chatId: chatId
            };
        } catch (e: any) {
            switch (e.constructor) {
                case CriaError:
                    this.setStatus(e.payload.status);
                    return {chatId: null, ...(e.payload as CriaResponse)};
                default:
                    this.setStatus(500);
                    return {
                        timestamp: Date.now().toString(),
                        status: 500,
                        code: "ERROR",
                        message: "Error creating the chat!",
                        chatId: null
                    };
            }

        }

    }

}
