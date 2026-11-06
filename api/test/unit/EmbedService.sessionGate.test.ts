import { EmbedService } from "../../src/services/EmbedService";
import { EmbedNotFoundError } from "../../src/services/ManageService";

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn()
  }));
});

describe("EmbedService session/publication gating", () => {
  it("rejects send when chat tracking belongs to another bot", async () => {
    const manageService = {
      retrieveBot: jest.fn().mockResolvedValue({
        botName: "bot-a",
        publish: true
      })
    };
    const messageCache = {
      get: jest.fn()
    };
    const trackingCache = {
      get: jest
        .fn()
        .mockResolvedValue({ botName: "bot-b", embedChatReady: true }),
      set: jest.fn()
    };

    const service = new EmbedService(
      manageService as any,
      messageCache as any,
      trackingCache as any,
      { insert: jest.fn(), find: jest.fn() } as any
    );

    await expect(
      service.sendEmbedChat("bot-a", "chat-1", "hello")
    ).rejects.toBeInstanceOf(EmbedNotFoundError);
  });
});
