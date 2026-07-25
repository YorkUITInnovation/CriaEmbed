import { EmbedService } from "../../src/services/EmbedService";
import { Config } from "../../src/config";
import { VectorStoreService } from "../../src/services/VectorStoreService";
import { EmbedNotFoundError } from "../../src/services/ManageService";
import { CriaError } from "../../src/models/CriaResponse";
import axios from "axios";

// Mock BotEmbed dependency
jest.mock("../../src/database/mysql/controllers/BotEmbed", () => ({
  BotEmbed: jest.fn().mockImplementation(() => ({
    retrieveByName: jest.fn().mockResolvedValue({
      botName: "mock-bot",
      botEmbedTheme: null,
      botEmbedDefaultEnabled: true,
      botEmbedPosition: 1,
      botWatermark: false,
      botLocale: "en-US",
      initialPrompts: [],
      botTrustWarning: null,
      botContact: null
    })
  }))
}));

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Redis globally
jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn()
  }));
});

// Mock VectorStoreService
jest.mock("../../src/services/VectorStoreService", () => {
  return {
    VectorStoreService: jest.fn().mockImplementation(() => {
      return {
        upsert: jest.fn(),
        search: jest.fn()
      };
    })
  };
});

describe("EmbedService - Negative Cases", () => {
  let embedService: EmbedService;
  let mockManageService: jest.Mocked<any>;
  let mockMessageCache: jest.Mocked<any>;
  let mockTrackingCache: jest.Mocked<any>;
  let mockUsageLog: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockManageService = {
      retrieveBot: jest.fn(),
      botExistsAndIsAuthorized: jest.fn().mockResolvedValue(true)
    };
    mockMessageCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("reply-id")
    };
    mockTrackingCache = {
      get: jest.fn().mockResolvedValue({ some: "data" }),
      set: jest.fn().mockResolvedValue("tracking-id")
    };
    mockUsageLog = {
      insert: jest.fn().mockResolvedValue(1),
      find: jest.fn().mockResolvedValue({ items: [], total: 0 })
    };

    embedService = new EmbedService(
      mockManageService,
      mockMessageCache,
      mockTrackingCache,
      mockUsageLog
    );
    (embedService as any).axios = mockedAxios;

    const vectorStoreInstance = (embedService as any).vectorStore;
    vectorStoreInstance.upsert.mockResolvedValue(undefined);
    vectorStoreInstance.search.mockResolvedValue([
      { id: "doc-id", score: 0.9 }
    ]);
  });

  describe("sendEmbedChat - Error Handling", () => {
    const botId = "test-bot";
    const chatId = "test-chat-id";
    const prompt = "Test prompt";

    it("should throw EmbedNotFoundError when bot does not exist", async () => {
      mockManageService.retrieveBot.mockRejectedValueOnce(
        new EmbedNotFoundError()
      );

      await expect(
        embedService.sendEmbedChat(botId, chatId, prompt)
      ).rejects.toThrow(EmbedNotFoundError);
    });

    it("should throw CriaError when Criabot API returns error", async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: "test-bot",
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: "en-US",
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null
      });

      mockedAxios.post.mockResolvedValueOnce({
        status: 500,
        data: {
          status: 500,
          code: "ERROR",
          message: "Internal server error"
        }
      } as any);

      const response = await embedService.sendEmbedChat(botId, chatId, prompt);
      expect(response.code).toBe("ERROR");
      expect(response.status).toBe(500);
    });

    it("should handle network errors from Criabot API", async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: "test-bot",
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: "en-US",
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null
      });

      mockedAxios.post.mockRejectedValueOnce(new Error("Network error"));

      await expect(
        embedService.sendEmbedChat(botId, chatId, prompt)
      ).rejects.toThrow();
    });

    it("should handle timeout errors from Criabot API", async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: "test-bot",
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: "en-US",
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null
      });

      const timeoutError = new Error("timeout of 30000ms exceeded");
      (timeoutError as any).code = "ECONNABORTED";
      mockedAxios.post.mockRejectedValueOnce(timeoutError);

      await expect(
        embedService.sendEmbedChat(botId, chatId, prompt)
      ).rejects.toThrow();
    });
  });

  describe("upsertEmbedding - Error Handling", () => {
    it("should handle VectorStoreService upsert errors", async () => {
      const id = "doc-id";
      const embedding = [0.1, 0.2, 0.3];
      const metadata = { source: "test" };

      const vectorStoreInstance = (embedService as any).vectorStore;
      vectorStoreInstance.upsert.mockRejectedValueOnce(
        new Error("Elasticsearch error")
      );

      await expect(
        embedService.upsertEmbedding(id, embedding, metadata)
      ).rejects.toThrow("Elasticsearch error");
    });

    it("should handle invalid embedding dimensions", async () => {
      const id = "doc-id";
      const embedding: number[] = []; // Empty embedding
      const metadata = { source: "test" };

      const vectorStoreInstance = (embedService as any).vectorStore;
      vectorStoreInstance.upsert.mockRejectedValueOnce(
        new Error("Invalid embedding dimension")
      );

      await expect(
        embedService.upsertEmbedding(id, embedding, metadata)
      ).rejects.toThrow();
    });
  });

  describe("searchEmbeddings - Error Handling", () => {
    it("should handle VectorStoreService search errors", async () => {
      const queryEmbedding = [0.4, 0.5, 0.6];
      const k = 5;

      const vectorStoreInstance = (embedService as any).vectorStore;
      vectorStoreInstance.search.mockRejectedValueOnce(
        new Error("Elasticsearch connection error")
      );

      await expect(
        embedService.searchEmbeddings(queryEmbedding, k)
      ).rejects.toThrow("Elasticsearch connection error");
    });

    it("should handle empty search results gracefully", async () => {
      const queryEmbedding = [0.4, 0.5, 0.6];
      const k = 5;

      const vectorStoreInstance = (embedService as any).vectorStore;
      vectorStoreInstance.search.mockResolvedValueOnce([]);

      const results = await embedService.searchEmbeddings(queryEmbedding, k);
      expect(results).toEqual([]);
    });
  });

  describe("retrieveEmbed - Error Handling", () => {
    it("should throw EmbedNotFoundError when bot not found", async () => {
      mockManageService.retrieveBot.mockRejectedValueOnce(
        new EmbedNotFoundError()
      );

      await expect(
        embedService.retrieveEmbed("non-existent-bot", false, false)
      ).rejects.toThrow(EmbedNotFoundError);
    });

    it("should handle missing bot configuration", async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce(null);

      await expect(
        embedService.retrieveEmbed("test-bot", false, false)
      ).rejects.toThrow();
    });
  });
});

describe("EmbedService publish gate", () => {
  const unpublished = {
    botName: "mock-bot",
    botTitle: "Hidden Bot",
    botGreeting: "Hi!",
    botEmbedDefaultEnabled: true,
    botEmbedPosition: 1,
    botWatermark: false,
    botLocale: "en-US"
  };

  function serviceWith(botConfig: any) {
    // Inject deps - the no-arg constructor opens a real MySQL pool.
    const service: any = new EmbedService(
      {
        retrieveBot: jest.fn().mockResolvedValue(botConfig),
        botExistsAndIsAuthorized: jest.fn()
      } as any,
      {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue("id")
      } as any,
      { get: jest.fn(), set: jest.fn() } as any,
      { insert: jest.fn(), find: jest.fn() } as any
    );
    service.ensureGreetingMessage = jest.fn().mockResolvedValue(undefined);
    service.createChat = jest.fn().mockResolvedValue("chat-1");
    return service;
  }

  it("blocks the config endpoint for an unpublished bot", async () => {
    const service = serviceWith({ ...unpublished, publish: false });
    await expect(
      service.retrieveEmbedConfig("chat-1", "mock-bot")
    ).rejects.toThrow(EmbedNotFoundError);
  });

  it("blocks the loader for an unpublished bot, before any chat is created", async () => {
    const service = serviceWith({ ...unpublished, publish: false });
    await expect(
      service.retrieveEmbed("mock-bot", false, false)
    ).rejects.toThrow(EmbedNotFoundError);
    // An unpublished bot must leave no trace behind.
    expect(service.createChat).not.toHaveBeenCalled();
  });

  it("fails closed when publish is missing or non-boolean", async () => {
    // A row that never received the Criabot sync must stay hidden, not default open.
    for (const value of [undefined, null, 0, "true"]) {
      const service = serviceWith({ ...unpublished, publish: value });
      await expect(
        service.retrieveEmbedConfig("chat-1", "mock-bot")
      ).rejects.toThrow(EmbedNotFoundError);
    }
  });

  it("allows an unpublished bot when the developer key matches", async () => {
    const service = serviceWith({
      ...unpublished,
      publish: false,
      developerMode: "dev-secret"
    });
    await expect(
      service.retrieveEmbedConfig("chat-1", "mock-bot", "dev-secret")
    ).resolves.toEqual(expect.objectContaining({ botId: "mock-bot" }));
    await expect(
      service.retrieveEmbed("mock-bot", false, false, "dev-secret")
    ).resolves.toEqual(expect.arrayContaining([expect.any(String)]));
  });

  it("blocks an unpublished bot when the developer key does not match", async () => {
    const service = serviceWith({
      ...unpublished,
      publish: false,
      developerMode: "dev-secret"
    });
    await expect(
      service.retrieveEmbedConfig("chat-1", "mock-bot", "wrong-secret")
    ).rejects.toThrow(EmbedNotFoundError);
  });

  it("allows a published bot through", async () => {
    const service = serviceWith({ ...unpublished, publish: true });
    await expect(
      service.retrieveEmbedConfig("chat-1", "mock-bot")
    ).resolves.toEqual(expect.objectContaining({ botId: "mock-bot" }));
  });
});
