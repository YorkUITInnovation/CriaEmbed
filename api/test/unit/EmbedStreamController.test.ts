jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn()
  }));
});

jest.mock("tsoa", () => {
  const decorator = () => () => undefined;
  class MockController {
    private headers: Record<string, string> = {};
    private status = 200;

    public setStatus(statusCode: number): void {
      this.status = statusCode;
    }

    public getStatus(): number {
      return this.status;
    }

    public setHeader(name: string, value: string): void {
      this.headers[name] = value;
    }

    public getHeaders(): Record<string, string> {
      return this.headers;
    }
  }
  return {
    Controller: MockController,
    Body: decorator,
    Middlewares: decorator,
    Path: decorator,
    Post: decorator,
    Route: decorator,
    Tags: decorator
  };
});

import {
  EmbedChatController,
  EmbedStreamController
} from "../../src/controllers/embed/EmbedChatController";
import { CriaError } from "../../src/models/CriaResponse";

describe("EmbedChatController", () => {
  let service: {
    sendEmbedChat: jest.Mock;
  };
  let controller: EmbedChatController;

  beforeEach(() => {
    service = {
      sendEmbedChat: jest.fn()
    };
    controller = new EmbedChatController(service as any);
  });

  it("throws when prompt is empty", async () => {
    await expect(
      controller.send("bot-id", {
        chatId: "chat-1",
        prompt: "   "
      })
    ).rejects.toBeInstanceOf(CriaError);
    expect(service.sendEmbedChat).not.toHaveBeenCalled();
  });

  it("returns mapped success payload from the service", async () => {
    service.sendEmbedChat.mockResolvedValueOnce({
      status: 200,
      code: "SUCCESS",
      timestamp: "1",
      message: "ok",
      reply: "Hello there",
      replyId: "reply-1",
      relatedPrompts: null,
      verifiedResponse: null
    });

    const result = await controller.send("bot-id", {
      chatId: "chat-1",
      prompt: "hello"
    });

    expect(service.sendEmbedChat).toHaveBeenCalledWith(
      "bot-id",
      "chat-1",
      "hello"
    );
    expect(result).toMatchObject({
      status: 200,
      code: "SUCCESS",
      reply: "Hello there"
    });
  });
});

describe("EmbedStreamController", () => {
  let service: {
    streamEmbedChat: jest.Mock;
  };
  let controller: EmbedStreamController;
  let setStatusSpy: jest.SpyInstance;
  let setHeaderSpy: jest.SpyInstance;

  beforeEach(() => {
    service = {
      streamEmbedChat: jest.fn()
    };
    controller = new EmbedStreamController(service as any);
    setStatusSpy = jest.spyOn(controller as any, "setStatus");
    setHeaderSpy = jest.spyOn(controller as any, "setHeader");
  });

  afterEach(() => {
    setStatusSpy.mockRestore();
    setHeaderSpy.mockRestore();
  });

  it("rejects empty prompt with CriaError", async () => {
    await expect(
      controller.stream("bot-id", {
        chatId: "chat-1",
        prompt: ""
      })
    ).rejects.toBeInstanceOf(CriaError);
    expect(service.streamEmbedChat).not.toHaveBeenCalled();
  });

  it("returns upstream SSE stream for TSOA piping on success", async () => {
    const upstreamStream = {
      pipe: jest.fn(),
      readable: true,
      _read: jest.fn()
    };

    service.streamEmbedChat.mockResolvedValueOnce({
      status: 200,
      data: upstreamStream
    });

    const result = await controller.stream("bot-id", {
      chatId: "chat-1",
      prompt: "hello"
    });

    expect(service.streamEmbedChat).toHaveBeenCalledWith(
      "bot-id",
      "chat-1",
      "hello"
    );
    expect(setStatusSpy).toHaveBeenCalledWith(200);
    expect(setHeaderSpy).toHaveBeenCalledWith(
      "Content-Type",
      "text/event-stream"
    );
    expect(setHeaderSpy).toHaveBeenCalledWith("Cache-Control", "no-cache");
    expect(setHeaderSpy).toHaveBeenCalledWith("Connection", "keep-alive");
    expect(result).toBe(upstreamStream);
  });

  it("returns JSON error payload when upstream responds with non-200", async () => {
    const upstream = {
      on: jest.fn((event: string, handler: (...args: any[]) => void) => {
        if (event === "data") {
          handler(Buffer.from('{"message":"Chat not found"}'));
        }
        if (event === "end") {
          handler();
        }
      })
    };

    service.streamEmbedChat.mockResolvedValueOnce({
      status: 404,
      data: upstream
    });

    const result = await controller.stream("bot-id", {
      chatId: "missing-chat",
      prompt: "hello"
    });

    expect(setStatusSpy).toHaveBeenCalledWith(404);
    expect(result).toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "Chat not found"
    });
  });

  it("maps service CriaError to response payload", async () => {
    service.streamEmbedChat.mockRejectedValueOnce(
      new CriaError("Criabot returned HTTP 502", 502)
    );

    const result = await controller.stream("bot-id", {
      chatId: "chat-1",
      prompt: "hello"
    });

    expect(setStatusSpy).toHaveBeenCalledWith(502, expect.any(CriaError));
    expect(result).toMatchObject({
      status: 502,
      code: "ERROR",
      message: "[Cria] Criabot returned HTTP 502"
    });
  });
});
