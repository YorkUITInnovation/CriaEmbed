import { EmbedService } from "../../src/services/EmbedService";
import { Config } from "../../src/config";
import { VectorStoreService } from "../../src/services/VectorStoreService"; // Import for typing the mock
import { buildEmbedCriabotPrompt } from "../../src/services/embedPrompt";

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

// Mock axios - use the module mock so BaseService axios calls are intercepted
jest.mock("axios");
import axios from "axios";
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
// This mock will ensure that every time new VectorStoreService() is called,
// it returns an object with fresh jest.fn() for upsert and search.
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

describe("EmbedService", () => {
  let embedService: EmbedService;
  let mockManageService: jest.Mocked<any>;
  let mockMessageCache: jest.Mocked<any>;
  let mockTrackingCache: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks(); // Clears all mocks, including VectorStoreService constructor and its methods

    mockManageService = {
      retrieveBot: jest.fn().mockResolvedValue({
        botName: "mock-bot",
        botTitle: "Test Bot",
        botSubTitle: "A sub title",
        botGreeting: "Hi there!",
        botIconUrl: "http://icon.url/icon.png",
        botEmbedTheme: "#FFFFFF",
        botEmbedDefaultEnabled: true,
        botEmbedPosition: "BL",
        botWatermark: false,
        botLocale: "en-US",
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null
      }),
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

    embedService = new EmbedService(
      mockManageService,
      mockMessageCache,
      mockTrackingCache
    );
    (embedService as any).axios = mockedAxios;

    // Now, after embedService is created, its internal vectorStore is an instance of our mocked VectorStoreService.
    // We can set up specific mock return values for its methods here.
    const vectorStoreInstance = (embedService as any).vectorStore;
    vectorStoreInstance.upsert.mockResolvedValue(undefined);
    vectorStoreInstance.search.mockResolvedValue([
      { id: "doc-id", score: 0.9 }
    ]);
  });

  it("should be defined", () => {
    expect(embedService).toBeDefined();
  });

  describe("createChat", () => {
    it("should return a valid UUID", async () => {
      const chatId = await embedService.createChat();
      expect(chatId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });
  });

  describe("upsertEmbedding", () => {
    it("should call vectorStore.upsert with correct parameters", async () => {
      const id = "doc-id";
      const embedding = [0.1, 0.2, 0.3];
      const metadata = { source: "test" };
      await embedService.upsertEmbedding(id, embedding, metadata);
      // Access the mocked instance's method directly from embedService
      expect((embedService as any).vectorStore.upsert).toHaveBeenCalledWith(
        id,
        embedding,
        metadata
      );
    });
  });

  describe("searchEmbeddings", () => {
    it("should call vectorStore.search with correct parameters", async () => {
      const queryEmbedding = [0.4, 0.5, 0.6];
      const k = 5;
      const mockSearchResults = [{ id: "doc-id", score: 0.9 }];
      // Configure the mock instance's search method
      (embedService as any).vectorStore.search.mockResolvedValueOnce(
        mockSearchResults
      );

      const results = await embedService.searchEmbeddings(queryEmbedding, k);
      expect(results).toEqual(mockSearchResults);
      // Access the mocked instance's method directly from embedService
      expect((embedService as any).vectorStore.search).toHaveBeenCalledWith(
        queryEmbedding,
        k
      );
    });
  });

  describe("retrieveEmbed", () => {
    it("uses the canonical bot name in the loader script and seeds the greeting cache", async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: "resolved-bot",
        botTitle: "Resolved Bot",
        botGreeting: "Welcome!",
        botIconUrl: "http://icon.url/icon.png",
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        embedHoverTooltip: null
      });
      mockMessageCache.get.mockResolvedValueOnce(null);
      mockMessageCache.set.mockResolvedValueOnce("greeting");

      const [embedScript, chatId] = await embedService.retrieveEmbed(
        "1321",
        false,
        false
      );

      expect(mockManageService.retrieveBot).toHaveBeenCalledWith(
        "1321",
        "",
        true
      );
      expect(mockMessageCache.set).toHaveBeenCalledWith(
        chatId,
        "Welcome!",
        "greeting"
      );
      expect(embedScript).toContain('"botId":"resolved-bot"');
      expect(embedScript).not.toContain('"botId":"1321"');
    });
  });

  describe("existsEmbedChat", () => {
    it("returns true from the greeting cache without querying Criabot", async () => {
      mockMessageCache.get.mockResolvedValueOnce("Hello from cache");

      const exists = await embedService.existsEmbedChat("chat-1");

      expect(exists).toBe(true);
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it("falls back to Criabot chat existence when the greeting cache is empty", async () => {
      mockMessageCache.get.mockResolvedValueOnce(null);
      mockedAxios.get.mockResolvedValueOnce({
        data: { code: "SUCCESS", exists: true }
      } as any);

      const exists = await embedService.existsEmbedChat("chat-2");

      expect(exists).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${Config.CRIA_BOT_SERVER_URL}/bots/chats/chat-2/exists?x-api-key=${Config.CRIA_BOT_SERVER_TOKEN}`,
        expect.objectContaining({
          timeout: 30000,
          validateStatus: expect.any(Function)
        })
      );
    });
  });

  describe("sendEmbedChat", () => {
    it("should send chat through Criabot chat endpoint and return mapped success payload", async () => {
      // Set up manageService and axios mocks
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: "mock-bot",
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: "en-US",
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null
      });
      mockTrackingCache.get.mockResolvedValueOnce(null).mockResolvedValueOnce({
        courseId: 13,
        courseName: "Art of Art",
        name: "I am a student and my name is Alex"
      });

      const enrichedPrompt = buildEmbedCriabotPrompt("hello", {
        courseId: 13,
        courseName: "Art of Art",
        name: "I am a student and my name is Alex"
      });

      // Criabot chat endpoint returns a valid structure
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          status: 200,
          code: "SUCCESS",
          message: "Successfully sent the chat",
          reply: {
            content: {
              content: "ok"
            },
            verified_response: true,
            related_prompts: [],
            context: null
          }
        }
      } as any);

      const resp = await embedService.sendEmbedChat(
        "mock-bot",
        "chat-1",
        "hello"
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${Config.CRIA_BOT_SERVER_URL}/bots/chats/chat-1/send`,
        {
          bot_name: "mock-bot",
          prompt: enrichedPrompt
        },
        expect.objectContaining({
          headers: { "x-api-key": Config.CRIA_BOT_SERVER_TOKEN }
        })
      );

      expect(resp.status).toBe(200);
      expect(resp.code).toBe("SUCCESS");
      expect(resp.reply).toBe("ok");
    });

    it("should use canonical bot name from manage service when posting chat", async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: "resolved-bot-name",
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: "en-US",
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null
      });
      mockTrackingCache.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          status: 200,
          code: "SUCCESS",
          message: "Successfully sent the chat",
          reply: {
            content: {
              content: "ok"
            },
            verified_response: true,
            related_prompts: [],
            context: null
          }
        }
      } as any);

      const resp = await embedService.sendEmbedChat(
        "1321",
        "chat-2",
        "hello again"
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${Config.CRIA_BOT_SERVER_URL}/bots/chats/chat-2/send`,
        {
          bot_name: "resolved-bot-name",
          prompt: "q: hello again"
        },
        expect.objectContaining({
          headers: { "x-api-key": Config.CRIA_BOT_SERVER_TOKEN }
        })
      );

      expect(resp.status).toBe(200);
    });

    it("should return non-success payload when Criabot returns a handled error", async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: "mock-bot",
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
        status: 400,
        data: {
          status: 400,
          code: "ERROR",
          message: "Bad request",
          reply: null
        }
      } as any);

      const resp = await embedService.sendEmbedChat("mock-bot", "chat-3", "hi");
      expect(resp.status).toBe(400);
      expect(resp.code).toBe("ERROR");
    });

    it("should throw CriaError when Criabot request fails at transport level", async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: "mock-bot",
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: "en-US",
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null
      });

      mockedAxios.post.mockRejectedValueOnce(new Error("network down"));

      await expect(
        embedService.sendEmbedChat("mock-bot", "chat-4", "hi")
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe("streamEmbedChat", () => {
    it("should proxy stream requests to the Criabot stream endpoint", async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: "mock-bot",
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: "en-US",
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null
      });
      mockTrackingCache.get.mockResolvedValueOnce(null).mockResolvedValueOnce({
        courseId: 13,
        courseName: "Art of Art",
        name: "I am a student and my name is Alex"
      });

      const enrichedPrompt = buildEmbedCriabotPrompt("hello", {
        courseId: 13,
        courseName: "Art of Art",
        name: "I am a student and my name is Alex"
      });

      const upstreamStream = { pipe: jest.fn() };
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: upstreamStream
      } as any);

      const response = await embedService.streamEmbedChat(
        "mock-bot",
        "chat-1",
        "hello"
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${Config.CRIA_BOT_SERVER_URL}/bots/chats/chat-1/stream`,
        {
          bot_name: "mock-bot",
          prompt: enrichedPrompt,
          extra_bots: []
        },
        expect.objectContaining({
          headers: {
            "x-api-key": Config.CRIA_BOT_SERVER_TOKEN,
            Accept: "text/event-stream"
          },
          responseType: "stream"
        })
      );
      expect(response.status).toBe(200);
      expect(response.data).toBe(upstreamStream);
    });

    it("should create a Criabot chat and retry stream when chat id is unknown", async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: "mock-bot",
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: "en-US",
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null
      });
      mockTrackingCache.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ criabotChatId: "started-chat-id" });

      mockedAxios.post
        .mockResolvedValueOnce({
          status: 404,
          data: { message: "not found" }
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: { chat_id: "started-chat-id" }
        } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: { pipe: jest.fn() }
        } as any);

      const response = await embedService.streamEmbedChat(
        "mock-bot",
        "chat-2",
        "hello again"
      );

      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        1,
        `${Config.CRIA_BOT_SERVER_URL}/bots/chats/chat-2/stream`,
        expect.any(Object),
        expect.objectContaining({ responseType: "stream" })
      );
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        2,
        `${Config.CRIA_BOT_SERVER_URL}/bots/chats/start`,
        {},
        expect.any(Object)
      );
      expect(mockTrackingCache.set).toHaveBeenCalledWith("chat-2", {
        criabotChatId: "started-chat-id"
      });
      expect(mockedAxios.post).toHaveBeenNthCalledWith(
        3,
        `${Config.CRIA_BOT_SERVER_URL}/bots/chats/started-chat-id/stream`,
        expect.objectContaining({
          bot_name: "mock-bot",
          prompt: "q: hello again"
        }),
        expect.objectContaining({ responseType: "stream" })
      );
      expect(response.status).toBe(200);
    });

    it("should throw CriaError when stream transport fails", async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: "mock-bot",
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: "en-US",
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null
      });
      mockTrackingCache.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockedAxios.post.mockRejectedValueOnce({
        response: { status: 503 },
        message: "upstream unavailable"
      });

      await expect(
        embedService.streamEmbedChat("mock-bot", "chat-5", "hello")
      ).rejects.toMatchObject({
        payload: expect.objectContaining({
          message: "[Cria] Criabot returned HTTP 503"
        })
      });
    });
  });
});
