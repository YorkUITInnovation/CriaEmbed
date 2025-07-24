import axios, {AxiosResponse} from "axios";
import {Config} from "../config";
import * as stream from "stream";
import {Readable} from "stream";
import {BaseService} from "./BaseService";
import AudioCache from "../database/redis/controllers/AudioCache";
import MessageCache from "../database/redis/controllers/MessageCache";

export type SpeechLanguage = "fr-FR" | "en-US";

const SpeechVoiceMap: Record<SpeechLanguage, string> = {
    "fr-FR": "fr-FR-BrigitteNeural",
    "en-US": "en-US-AriaNeural"
}

export class ChatContentNotFoundError extends Error {}


export default class SpeechService extends BaseService {

    constructor(
        private audioCache: AudioCache = new AudioCache(),
        private messageCache: MessageCache = new MessageCache()
    ) {
        super();
    }

    async getChatSpeech(
        chatId: string,
        messageId: string,
        language: SpeechLanguage
    ): Promise<Readable> {
        const audioCache: Buffer | null = await this.audioCache.get(chatId, messageId);

        // From cache
        if (audioCache !== null) {
            return Readable.from(audioCache);
        }

        // Retrieve text
        const messageText: string | null = await this.messageCache.get(chatId, messageId);
        if (messageText == null) {
            throw new ChatContentNotFoundError();
        }

        // Start audio generation stream from cached text
        const audioStream: Readable = await this.generate(messageText, language);

        // Pass audio to a new stream for caching and return the original
        this.cacheAudio(chatId, messageId, audioStream);
        return audioStream;

    }

    private cacheAudio(chatId: string, messageId: string, audioStream: Readable): void {
        const passThrough = new stream.PassThrough();
        const bufferChunks: Uint8Array[] = [];

        passThrough.on('data', (chunk) => bufferChunks.push(chunk));

        passThrough.on('end', async () => {

            await this.audioCache.set(
                chatId,
                messageId,
                Buffer.concat(bufferChunks)
            )

        });

        audioStream.pipe(passThrough);

    }

    private escapeXml(unsafe: string): string {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    private async generate(text: string, lang: SpeechLanguage): Promise<Readable> {

        const xmlBody = `
            <speak version='1.0' xml:lang='${lang}'>
                <voice xml:lang='${lang}' name='${SpeechVoiceMap[lang]}'>
                    ${this.escapeXml(text)}
                </voice>
            </speak>
        `;

        const result: AxiosResponse = await axios.post(
            Config.AZURE_SPEECH_API_URL,
            xmlBody,
            {
                responseType: 'stream',
                headers: {
                    "Content-Type": "application/ssml+xml",
                    "Ocp-Apim-Subscription-Key": Config.AZURE_SPEECH_API_KEY,
                    "X-Microsoft-OutputFormat": "webm-16khz-16bit-mono-opus"
                },
            }
        );

        return result.data;

    }
}
