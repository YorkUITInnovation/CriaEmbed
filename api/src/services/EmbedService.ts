import {BaseService} from "./BaseService";
import {BotLocale, EmbedPosition, IBotEmbed} from "../database/mysql/controllers/BotEmbed";
import {ManageService} from "./ManageService";
import {AxiosResponse} from "axios";
import {Config} from "../config";
import {
    CriaError,
    CriaResponseCode,
    CriaResponseStatus,
    SendChatResponse
} from "../models/CriaResponse";
import * as fs from "fs";
import path from "path";
import MessageCache from "../database/redis/controllers/MessageCache";
import {parse} from "node-html-parser";

const EMBED_BASE_SCRIPT: string = fs.readFileSync(
    path.join(Config.ASSETS_FOLDER_PATH, "/public/loader.js")
).toString();

type EmbedLoadConfig = {
    webAppUrl: string;
    chatApiUrl: string;
    botId: string;
    chatId: string;
    botName?: string | null;
    botSubName?: string | null;
    botGreeting?: string | null;
    botGreetingId?: string | null;
    botIconUrl?: string | null;
    embedTheme?: string | null;
    embedPosition?: EmbedPosition | null;
    defaultEnabled?: boolean | null;
    watermarkEnabled?: boolean | null;
    botLocale?: BotLocale | null,
    initialPrompts?: CriabotChatResponseRelatedPrompt[] | null
}

type CriaGetGPTResponseFunctionParams = {
    bot_id: string,
    chat_id: string,
    prompt: string,
    filters: string
}

export type CriaGetGPTResponseFunctionResponse = {
    prompt_tokens: number | null,
    completion_tokens: number | null,
    total_tokens: number | null,
    cost: number | null,
    file_name: string | null,
    message: string | null,
    stacktrace: string,
    reply: Record<string, string> | null
}

export type CriabotChatResponseRelatedPrompt = {
  label: string,
  prompt: string,
}


export type CriabotChatReply = {
  related_prompts: CriabotChatResponseRelatedPrompt[]
}

export type CriabotChatResponse = {
    status: number,
    message: string | null,
    timestamp: number,
    code: string,
    reply: CriabotChatReply | null
    total_usage: number | null
    related_prompts: CriabotChatResponseRelatedPrompt
}

export class EmbedService extends BaseService {

    constructor(
        private manageService: ManageService = new ManageService(),
        private messageCache: MessageCache = new MessageCache()
    ) {
        super();
    }

    async createChat(): Promise<string> {

        const response: AxiosResponse = await this.post(
            this.buildServiceURL(
                "cria_get_chat_id", {}
            )
        )

        const chatId: string = response.data;

        if (chatId) {
            return chatId;
        } else {
            throw new CriaError("Failed to receive a Chat ID!");
        }

    }

    private async sendChat(
        botName: string,
        chatId: string,
        prompt: string,
    ): Promise<CriaGetGPTResponseFunctionResponse> {

        const functionParams: CriaGetGPTResponseFunctionParams = {
            bot_id: botName,
            chat_id: chatId,
            prompt: prompt,
            filters: "" // Never any filters
        }

        const response: AxiosResponse = await this.post(
            this.buildServiceURL(
                "cria_get_gpt_response", functionParams
            )
        )

        return response.data as CriaGetGPTResponseFunctionResponse;

    }

    private preProcessConfig(config: EmbedLoadConfig): EmbedLoadConfig {

        config.embedTheme = config.embedTheme || null;
        config.botName ||= config.botId;
        config.botIconUrl ||= Config.THIS_APP_URL + "/public/popup/cria.png";
        config.embedPosition ||= EmbedPosition.BL;
        config.botLocale ||= "en-US";

        if (config.embedTheme && !config.embedTheme.startsWith("#")) {
            config.embedTheme = "#" + config.embedTheme;
        }

        return config;

    }

    private loadEmbedScript(config: EmbedLoadConfig): string {

        return EMBED_BASE_SCRIPT.replace(
            "$objectReplace",
            JSON.stringify(this.preProcessConfig(config))
        );

    }

    async retrieveEmbed(
        botName: string,
        embedPosition?: EmbedPosition
    ): Promise<string> {

        const botConfig: IBotEmbed = await this.manageService.retrieveBot(botName, "", true);
        const chatId: string = await this.createChat();

        const botGreeting: string = botConfig.botGreeting || Config.DEFAULT_BOT_GREETING;
        const botGreetingId: string = await this.messageCache.set(chatId, botGreeting, "greeting");

        return this.loadEmbedScript({
            chatId: chatId,
            webAppUrl: Config.WEB_APP_URL,
            chatApiUrl: Config.THIS_APP_URL,
            botId: botConfig.botName,
            botName: botConfig.botTitle,
            botSubName: botConfig.botSubTitle,
            botGreeting: botGreeting,
            botGreetingId: botGreetingId,
            botIconUrl: botConfig.botIconUrl,
            embedTheme: botConfig.botEmbedTheme,
            defaultEnabled: botConfig.botEmbedDefaultEnabled,
            embedPosition: embedPosition || botConfig.botEmbedPosition,
            watermarkEnabled: botConfig.botWatermark,
            botLocale: botConfig.botLocale,
            initialPrompts: botConfig.initialPrompts
        });

    }

    async existsEmbedChat(chatId: string): Promise<boolean> {

        const response: AxiosResponse = await this.get(
            Config.CRIA_BOT_SERVER_URL + `/bots/chats/${chatId}/exists?x-api-key=${Config.CRIA_BOT_SERVER_TOKEN}`
        )

        if (response.data.code !== "SUCCESS") {
            throw new CriaError(
                "Error: " +
                (JSON.stringify(response.data))
            )
        }

        const exists: boolean | null | undefined = response.data.exists;

        if (exists === null || exists === undefined) {
            throw new CriaError(
                "Error: Response shows undefined exists. Payload read error?"
            )
        }

        return exists;


    }

    async sendEmbedChat(botName: string, chatId: string, prompt: string): Promise<SendChatResponse> {

        const chatResponse: CriaGetGPTResponseFunctionResponse = await this.sendChat(botName, chatId, prompt);
        const criaBotResponse: CriabotChatResponse = JSON.parse(chatResponse.stacktrace);

        // Non-success code
        if (criaBotResponse.code !== "SUCCESS") {

            // Exception
            if (chatResponse?.reply?.exception) {
                throw new CriaError(
                    "Error: " +
                    (chatResponse.stacktrace || chatResponse.message)
                )
            }

            // Failed
            return {
                message: criaBotResponse.message || criaBotResponse.status.toString(),
                status: criaBotResponse.status as CriaResponseStatus,
                code: criaBotResponse.code as CriaResponseCode,
                timestamp: Date.now().toString(),
                reply: null,
                replyId: null,
                relatedPrompts: null
            }
        }

        // Save ID for TTS
        const replyId: string | null = (
            chatResponse.message ?
                await this.messageCache.set(
                    chatId,
                    parse(chatResponse.message).textContent
                ) :
                null
        );

        return {
            message: criaBotResponse.message || "Success!",
            status: 200,
            code: "SUCCESS",
            timestamp: Date.now().toString(),
            reply: chatResponse.message,
            replyId: replyId,
            relatedPrompts: criaBotResponse?.reply?.related_prompts || null
        }

    }

}
