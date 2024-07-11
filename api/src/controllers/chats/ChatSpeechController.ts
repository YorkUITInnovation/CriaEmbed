import {Get, Path, Query, Route, Tags} from "tsoa";
import {BaseController} from "../../models/BaseController";
import {EmbedService} from "../../services/EmbedService";
import {ChatAudioResponse, CriaError, CriaResponse} from "../../models/CriaResponse";
import SpeechService, {ChatContentNotFoundError, SpeechLanguage} from "../../services/SpeechService";
import {Readable} from "stream";


@Tags("Embed")
@Route("/embed/{chatId}/speech")
export class ChatSpeechController extends BaseController {

    service: SpeechService;

    constructor(
        private embedService: EmbedService = new EmbedService(),
    ) {
        super();
        this.service = new SpeechService();
    }

    @Get()
    public async speech(
        @Path() chatId: string,
        @Query() messageId: string,
        @Query() language: SpeechLanguage,
    ): Promise<ChatAudioResponse | Readable> {

        try {

            if (!await this.embedService.existsEmbedChat(chatId)) {
                this.setStatus(404);
                return {
                    timestamp: Date.now().toString(),
                    status: 404,
                    code: "NOT_FOUND",
                    message: "The requested chat could not be found or is expired.",
                };
            }

            this.setHeader("Content-Type", "audio/webm");
            this.setHeader("Transfer-Encoding", "chunked");
            return await this.service.getChatSpeech(chatId, messageId, language);
        } catch (e: any) {
            switch (e.constructor) {
                case ChatContentNotFoundError:
                    this.setStatus(500);
                    return {
                        timestamp: Date.now().toString(),
                        status: 404,
                        code: "NOT_FOUND",
                        message: "The chat exists but the cached chat content could not be found or is expired.",
                    };
                case CriaError:
                    const payload: CriaResponse = e.payload;
                    this.setStatus(payload.status);
                    return payload;
                default:
                    this.setStatus(500);
                    console.log(e.stack)
                    return {
                        timestamp: Date.now().toString(),
                        status: 500,
                        code: "ERROR",
                        message: "Error receiving an audio stream!",
                    };
            }

        }

    }

}
