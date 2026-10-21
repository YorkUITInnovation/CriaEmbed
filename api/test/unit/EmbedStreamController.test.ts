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
    Request: decorator,
    Route: decorator,
    Tags: decorator
  };
});

import {
  EmbedChatController,
  EmbedStreamController
} from "../../src/controllers/embed/EmbedChatController";
import { CriaError } from "../../src/models/CriaResponse";
import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";
import express from "express";
import type { AddressInfo } from "node:net";
import { criaErrorMiddleware } from "../../src/criaErrorMiddleware";

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

  const mockRequest = { ip: "127.0.0.1" } as any;

  it("throws when prompt is empty", async () => {
    await expect(
      controller.send(
        "bot-id",
        {
          chatId: "chat-1",
          prompt: "   "
        },
        mockRequest
      )
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

    const result = await controller.send(
      "bot-id",
      {
        chatId: "chat-1",
        prompt: "hello"
      },
      mockRequest
    );

    expect(service.sendEmbedChat).toHaveBeenCalledWith(
      "bot-id",
      "chat-1",
      "hello",
      false,
      "127.0.0.1"
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

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["over limit", "x".repeat(4001)]
  ])(
    "returns HTTP 400 through Express for a %s streaming prompt",
    async (_label, prompt) => {
      const app = express();
      app.use(express.json());
      app.post("/stream", (req, res, next) => {
        void controller
          .stream("bot-id", req.body, req)
          .then(result => res.json(result))
          .catch(next);
      });
      app.use(criaErrorMiddleware);
      const server = app.listen(0, "127.0.0.1");
      try {
        await new Promise<void>(resolve => server.once("listening", resolve));
        const port = (server.address() as AddressInfo).port;
        const response = await fetch(`http://127.0.0.1:${port}/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId: "chat-1", prompt })
        });
        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
          status: 400,
          code: "ERROR"
        });
        expect(service.streamEmbedChat).not.toHaveBeenCalled();
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close(error => (error ? reject(error) : resolve()))
        );
      }
    }
  );

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
      "hello",
      undefined,
      expect.any(Object)
    );
    expect(setStatusSpy).toHaveBeenCalledWith(200);
    expect(setHeaderSpy).toHaveBeenCalledWith(
      "Content-Type",
      "text/event-stream"
    );
    expect(setHeaderSpy).toHaveBeenCalledWith(
      "Cache-Control",
      "no-cache, no-transform"
    );
    expect(setHeaderSpy).toHaveBeenCalledWith("X-Accel-Buffering", "no");
    expect(setHeaderSpy).toHaveBeenCalledWith("Connection", "keep-alive");
    expect(result).toBe(upstreamStream);
  });

  it("forwards chunks before upstream completion without buffering", async () => {
    const upstream = new PassThrough();
    service.streamEmbedChat.mockResolvedValueOnce({
      status: 200,
      data: upstream
    });
    const result = await controller.stream("bot-id", {
      chatId: "chat-1",
      prompt: "hello"
    });
    expect(result).toBe(upstream);
    const chunks: string[] = [];
    upstream.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    upstream.write('data: {"type":"chunk","content":"Hello"}\n\n');
    expect(chunks).toEqual(['data: {"type":"chunk","content":"Hello"}\n\n']);
    expect(upstream.readableEnded).toBe(false);
    upstream.end();
  });

  it("terminates the HTTP response and cancels work on an upstream reset", async () => {
    const upstream = new PassThrough();
    const cancel = jest.fn();
    service.streamEmbedChat.mockImplementationOnce(
      async (_bot, _chat, _prompt, _version, hooks) => {
        hooks.registerCancel(cancel);
        return { status: 200, data: upstream };
      }
    );
    const res = Object.assign(new EventEmitter(), {
      destroyed: false,
      destroy: jest.fn()
    });
    await controller.stream("bot-id", { chatId: "chat-reset", prompt: "hello" }, { res } as any);
    upstream.destroy(Object.assign(new Error("aborted"), { code: "ECONNRESET" }));
    await new Promise(resolve => setImmediate(resolve));
    expect(res.destroy).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("survives a partial HTTP stream reset and serves the next request", async () => {
    const upstream = new PassThrough();
    const cancel = jest.fn();
    service.streamEmbedChat.mockImplementationOnce(
      async (_bot, _chat, _prompt, _version, hooks) => {
        hooks.registerCancel(cancel);
        return { status: 200, data: upstream };
      }
    );
    const app = express();
    app.post("/stream", (req, res, next) => {
      void controller.stream("bot-id", { chatId: "chat-reset", prompt: "hello" }, req)
        .then(result => {
          if (result instanceof PassThrough) {
            res.setHeader("Content-Type", "text/event-stream");
            result.pipe(res);
            upstream.write('data: {"type":"chunk","content":"partial"}\n\n');
          }
        })
        .catch(next);
    });
    app.get("/health", (_req, res) => res.json({ ok: true }));
    const server = app.listen(0, "127.0.0.1");
    try {
      await new Promise<void>(resolve => server.once("listening", resolve));
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/stream`, { method: "POST" });
      const reader = response.body!.getReader();
      const first = await reader.read();
      expect(new TextDecoder().decode(first.value)).toContain("partial");
      upstream.destroy(Object.assign(new Error("aborted"), { code: "ECONNRESET" }));
      await expect(reader.read()).rejects.toThrow();
      expect(cancel).toHaveBeenCalled();
      const health = await fetch(`http://127.0.0.1:${port}/health`);
      expect(await health.json()).toEqual({ ok: true });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close(error => error ? reject(error) : resolve())
      );
    }
  });

  it("handles a reset that occurred before the controller received the stream", async () => {
    const upstream = new PassThrough();
    upstream.on("error", () => {});
    upstream.destroy(new Error("early reset"));
    await new Promise(resolve => setImmediate(resolve));
    service.streamEmbedChat.mockResolvedValueOnce({ status: 200, data: upstream });
    const res = Object.assign(new EventEmitter(), {
      destroyed: false,
      destroy: jest.fn()
    });
    await controller.stream("bot-id", { chatId: "chat-early-reset", prompt: "hello" }, { res } as any);
    expect(res.destroy).toHaveBeenCalledTimes(1);
  });

  it("fires a cancel that registers after the client already closed", async () => {
    const cancel = jest.fn();
    service.streamEmbedChat.mockImplementation(
      async (_bot: any, _chat: any, _prompt: any, _v: any, hooks: any) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        hooks.registerCancel(cancel);
        return { status: 200, data: new PassThrough() };
      }
    );
    const resEmitter = new EventEmitter();
    const request: any = { ip: "127.0.0.1", res: resEmitter };

    const pending = (controller.stream as any)(
      "bot-id",
      { chatId: "chat-1", prompt: "hello" },
      request
    );
    // Client closes BEFORE the service registers its cancel callback.
    resEmitter.emit("close");
    const result: any = await pending;

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(result).toBeInstanceOf(PassThrough);
  });

  it("rejects prompts above the send endpoint's 4000-character limit", async () => {
    await expect(
      controller.stream("bot-id", {
        chatId: "chat-1",
        prompt: "a".repeat(4001)
      })
    ).rejects.toMatchObject({
      payload: expect.objectContaining({ status: 400 })
    });
    expect(service.streamEmbedChat).not.toHaveBeenCalled();
  });

  it("accepts a prompt exactly at the 4000-character limit", async () => {
    const upstream = new PassThrough();
    service.streamEmbedChat.mockResolvedValueOnce({
      status: 200,
      data: upstream
    });
    const prompt = "a".repeat(4000);
    expect(
      await controller.stream("bot-id", { chatId: "chat-1", prompt })
    ).toBe(upstream);
    expect(service.streamEmbedChat).toHaveBeenCalledWith(
      "bot-id",
      "chat-1",
      prompt,
      undefined,
      expect.any(Object)
    );
    upstream.destroy();
  });

  it("forwards stream_version to EmbedService", async () => {
    const upstream = new PassThrough();
    service.streamEmbedChat.mockResolvedValueOnce({
      status: 200,
      data: upstream
    });
    await controller.stream("bot-id", {
      chatId: "chat-1",
      prompt: "hello",
      stream_version: 2
    });
    expect(service.streamEmbedChat).toHaveBeenCalledWith(
      "bot-id",
      "chat-1",
      "hello",
      2,
      expect.any(Object)
    );
    upstream.destroy();
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
