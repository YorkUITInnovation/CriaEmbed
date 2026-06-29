import { Body, Middlewares, Path, Post, Route, Tags } from "tsoa";
import { Readable } from "stream";
import { EmbedNotFoundError } from "../../services/ManageService.js";
import { BaseController } from "../../models/BaseController.js";
import { EmbedService } from "../../services/EmbedService.js";
import {
  CriaError,
  CriaResponse,
  CriaResponseStatus,
  SendChatResponse
} from "../../models/CriaResponse.js";
import { RATE_LIMIT_CHAT_ALL_HANDLERS } from "../../models/LimitGenerator.js";

type ChatPayload = {
  chatId: string;
  prompt: string;
};

@Tags("Embed")
@Route("/embed/{botId}/send")
export class EmbedChatController extends BaseController {
  constructor(public service: EmbedService = new EmbedService()) {
    super();
  }

  @Post()
  @Middlewares(...RATE_LIMIT_CHAT_ALL_HANDLERS)
  public async send(
    @Path() botId: string,
    @Body() config: ChatPayload
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
      throw new CriaError(
        `prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters.`
      );
    }

    try {
      const chat: SendChatResponse = await this.service.sendEmbedChat(
        botId,
        config.chatId,
        prompt
      );
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
            message:
              "The requested bot does NOT have embeds enabled or does not exist.",
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

@Tags("Embed")
@Route("/embed/{botId}/stream")
export class EmbedStreamController extends BaseController {
  constructor(public service: EmbedService = new EmbedService()) {
    super();
  }

  @Post()
  @Middlewares(...RATE_LIMIT_CHAT_ALL_HANDLERS)
  public async stream(
    @Path() botId: string,
    @Body() config: ChatPayload
  ): Promise<Readable | CriaResponse> {
    if (!botId || botId.trim().length === 0) {
      throw new CriaError("Invalid botId provided.");
    }

    if (!config?.chatId || config.chatId.trim().length === 0) {
      throw new CriaError("chatId is required.");
    }

    const prompt: string = config?.prompt ?? "";
    if (prompt.trim().length === 0) {
      throw new CriaError("prompt must not be empty.", 400);
    }

    try {
      const response = await this.service.streamEmbedChat(
        botId,
        config.chatId,
        prompt
      );

      if (response.status !== 200) {
        const bodyText = await this.streamToString(response.data);
        let upstreamMessage =
          bodyText || `Upstream responded with HTTP ${response.status}`;

        try {
          const bodyJson = JSON.parse(bodyText);
          upstreamMessage = bodyJson?.message || upstreamMessage;
        } catch (_error) {
          // Keep raw text body when upstream did not return JSON.
        }

        this.setStatus(response.status);
        return {
          timestamp: Date.now().toString(),
          status: response.status as CriaResponseStatus,
          code: response.status === 404 ? "NOT_FOUND" : "ERROR",
          message: upstreamMessage
        };
      }

      this.setStatus(200);
      this.setHeader("Content-Type", "text/event-stream");
      this.setHeader("Cache-Control", "no-cache");
      this.setHeader("Connection", "keep-alive");
      // Return the upstream stream so TSOA pipes it to the client.
      // Do not return "" here: TSOA would call res.json("") and clobber SSE.
      return response.data;
    } catch (e: any) {
      switch (e.constructor) {
        case EmbedNotFoundError:
          this.setStatus(404, e);
          return {
            timestamp: Date.now().toString(),
            status: 404,
            code: "NOT_FOUND",
            message:
              "The requested bot does NOT have embeds enabled or does not exist."
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
            message: "Error creating stream response due to an internal error."
          };
      }
    }
  }

  private async streamToString(streamObj: any): Promise<string> {
    if (!streamObj) {
      return "";
    }

    if (typeof streamObj === "string") {
      return streamObj;
    }

    if (typeof streamObj?.on !== "function") {
      return "";
    }

    return await new Promise((resolve, reject) => {
      const chunks: any[] = [];
      streamObj.on("data", (chunk: any) => chunks.push(chunk));
      streamObj.on("error", (err: any) => reject(err));
      streamObj.on("end", () =>
        resolve(Buffer.concat(chunks).toString("utf-8"))
      );
    });
  }
}
