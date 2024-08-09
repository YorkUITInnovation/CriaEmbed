import {CriabotChatResponseRelatedPrompt, EmbedPublicConfig} from "../services/EmbedService";

export type CriaResponseStatus = 200 | 300 | 401 | 500 | 301 | 302 | 409 | 403 | 405 | 429 | 404 | 422;
export type CriaResponseCode =
    "ERROR"
    | "UNAUTHORIZED"
    | "SUCCESS"
    | "NOT_FOUND"
    | "DUPLICATE"
    | "TOO_MANY_REQUESTS"
    | "INVALID";


export type CriaResponse = {
  status: CriaResponseStatus;
  timestamp: string;
  code: CriaResponseCode;
  message: string;
  detail?: Record<string, object>
}


export interface SendChatResponse extends CriaResponse {
  reply: string | null;
  replyId: string | null;
  relatedPrompts: CriabotChatResponseRelatedPrompt[] | null;
}

export interface EmbedConfigResponse extends CriaResponse {
  config?: EmbedPublicConfig
}

export interface ChatAudioResponse extends CriaResponse {

}


export interface ExistsChatResponse extends CriaResponse {
  exists: boolean | null;
}

export interface CreateChatResponse extends CriaResponse {
  chatId: string | null;
}


export const API_KEY_HEADER_NAME: string = "X-Api-Key";


export class CriaError extends Error {
  public readonly payload: CriaResponse;

  constructor(message: string) {
    super();

    this.payload = this.strippedResponse({
      message: `[Cria] ${message}`,
      status: 500,
      timestamp: Date.now().toString(),
      code: "ERROR"
    });

  }

  private strippedResponse(response: CriaResponse): CriaResponse {
    return {
      status: response.status,
      timestamp: response.timestamp || Date.now().toString(),
      message: response.status === 401 ? "You are unauthorized for this action :(" : response.message,
      code: response.code
    }
  }
}

