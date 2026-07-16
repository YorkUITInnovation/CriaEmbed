jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn()
  }));
});

import { ChannelHandler } from "../../src/services/azureBots/ChannelHandler";

// Concrete subclass to exercise the protected branch logic.
class TestHandler extends ChannelHandler {
  async onMessage(): Promise<void> {}
  publicGetOrCreateChat(ctx: any) {
    return this.getOrCreateChat(ctx);
  }
  publicGetBotResponse(ctx: any, chatId: string) {
    return this.getBotResponse(ctx, chatId);
  }
}

const ctx = (conversationId: string, text = "hi") => ({
  activity: { conversation: { id: conversationId }, text }
});

describe("ChannelHandler.getOrCreateChat", () => {
  let service: any;
  let chatCache: any;
  let handler: TestHandler;

  beforeEach(() => {
    service = {
      existsEmbedChat: jest.fn(),
      createChat: jest.fn(),
      sendEmbedChat: jest.fn()
    };
    chatCache = { get: jest.fn(), set: jest.fn(), delete: jest.fn() };
    handler = new TestHandler({ botName: "bot" } as any, service, chatCache);
  });

  it("reuses an existing chat when the cached id still exists", async () => {
    chatCache.get.mockResolvedValueOnce("chat-1");
    service.existsEmbedChat.mockResolvedValueOnce(true);

    const result = await handler.publicGetOrCreateChat(ctx("conv-1"));

    expect(result).toEqual({ chatId: "chat-1", new: false });
    expect(service.createChat).not.toHaveBeenCalled();
    expect(chatCache.set).not.toHaveBeenCalled();
    expect(chatCache.delete).not.toHaveBeenCalled();
  });

  it("recreates the chat when the cached id no longer exists", async () => {
    chatCache.get.mockResolvedValueOnce("stale-chat");
    service.existsEmbedChat.mockResolvedValueOnce(false);
    service.createChat.mockResolvedValueOnce("chat-new");

    const result = await handler.publicGetOrCreateChat(ctx("conv-1"));

    expect(chatCache.delete).toHaveBeenCalledWith("conv-1");
    expect(service.createChat).toHaveBeenCalledTimes(1);
    expect(chatCache.set).toHaveBeenCalledWith("conv-1", "chat-new");
    expect(result).toEqual({ chatId: "chat-new", new: true });
  });

  it("creates a new chat on a cache miss", async () => {
    chatCache.get.mockResolvedValueOnce(null);
    service.createChat.mockResolvedValueOnce("chat-new");

    const result = await handler.publicGetOrCreateChat(ctx("conv-2"));

    expect(service.existsEmbedChat).not.toHaveBeenCalled();
    expect(chatCache.set).toHaveBeenCalledWith("conv-2", "chat-new");
    expect(result).toEqual({ chatId: "chat-new", new: true });
  });
});

describe("ChannelHandler.getBotResponse", () => {
  let service: any;
  let handler: TestHandler;

  beforeEach(() => {
    service = { sendEmbedChat: jest.fn() };
    handler = new TestHandler({ botName: "bot" } as any, service, {
      get: jest.fn()
    } as any);
  });

  it("returns the reply content on a 200", async () => {
    service.sendEmbedChat.mockResolvedValueOnce({
      status: 200,
      reply: "Hello!",
      fullResponse: { reply: { related_prompts: [] } }
    });

    const out = await handler.publicGetBotResponse(
      ctx("c", "question"),
      "chat-1"
    );

    expect(out.prompt).toBe("question");
    expect(out.replyMessage).toBe("Hello!");
  });

  it("formats a failure message (with status + chat id) on a non-200", async () => {
    service.sendEmbedChat.mockResolvedValueOnce({ status: 503, reply: null });

    const out = await handler.publicGetBotResponse(ctx("c", "q"), "chat-9");

    expect(out.replyMessage).toContain("503");
    expect(out.replyMessage).toContain("chat-9");
  });
});
