import { EmbedService } from '../../src/services/EmbedService';
import { Config } from '../../src/config';
import { VectorStoreService } from '../../src/services/VectorStoreService'; // Import for typing the mock

// Mock BotEmbed dependency
jest.mock('../../src/database/mysql/controllers/BotEmbed', () => ({
  BotEmbed: jest.fn().mockImplementation(() => ({
    retrieveByName: jest.fn().mockResolvedValue({
      botName: 'mock-bot',
      botEmbedTheme: null,
      botEmbedDefaultEnabled: true,
      botEmbedPosition: 1,
      botWatermark: false,
      botLocale: 'en-US',
      initialPrompts: [],
      botTrustWarning: null,
      botContact: null,
    }),
  })),
}));

// Mock axios - use the module mock so BaseService axios calls are intercepted
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock Redis globally
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
  }));
});

// Mock VectorStoreService
// This mock will ensure that every time new VectorStoreService() is called,
// it returns an object with fresh jest.fn() for upsert and search.
jest.mock('../../src/services/VectorStoreService', () => {
  return {
    VectorStoreService: jest.fn().mockImplementation(() => {
      return {
        upsert: jest.fn(),
        search: jest.fn(),
      };
    }),
  };
});

describe('EmbedService', () => {
  let embedService: EmbedService;
  let mockManageService: jest.Mocked<any>;
  let mockMessageCache: jest.Mocked<any>;
  let mockTrackingCache: jest.Mocked<any>;

  beforeEach(() => {
    jest.clearAllMocks(); // Clears all mocks, including VectorStoreService constructor and its methods

    mockManageService = {
      retrieveBot: jest.fn().mockResolvedValue({
        botName: 'mock-bot',
        botTitle: 'Test Bot',
        botSubTitle: 'A sub title',
        botGreeting: 'Hi there!',
        botIconUrl: 'http://icon.url/icon.png',
        botEmbedTheme: '#FFFFFF',
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 'BL',
        botWatermark: false,
        botLocale: 'en-US',
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null,
      }),
      botExistsAndIsAuthorized: jest.fn().mockResolvedValue(true),
    };
    mockMessageCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('reply-id'),
    };
    mockTrackingCache = {
      get: jest.fn().mockResolvedValue({ some: 'data' }),
      set: jest.fn().mockResolvedValue('tracking-id'),
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
    vectorStoreInstance.search.mockResolvedValue([{ id: 'doc-id', score: 0.9 }]);
  });

  it('should be defined', () => {
    expect(embedService).toBeDefined();
  });

  describe('createChat', () => {
    it('should return a valid UUID', async () => {
      const chatId = await embedService.createChat();
      expect(chatId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe('upsertEmbedding', () => {
    it('should call vectorStore.upsert with correct parameters', async () => {
      const id = 'doc-id';
      const embedding = [0.1, 0.2, 0.3];
      const metadata = { source: 'test' };
      await embedService.upsertEmbedding(id, embedding, metadata);
      // Access the mocked instance's method directly from embedService
      expect((embedService as any).vectorStore.upsert).toHaveBeenCalledWith(id, embedding, metadata);
    });
  });

  describe('searchEmbeddings', () => {
    it('should call vectorStore.search with correct parameters', async () => {
      const queryEmbedding = [0.4, 0.5, 0.6];
      const k = 5;
      const mockSearchResults = [{ id: 'doc-id', score: 0.9 }];
      // Configure the mock instance's search method
      (embedService as any).vectorStore.search.mockResolvedValueOnce(mockSearchResults);

      const results = await embedService.searchEmbeddings(queryEmbedding, k);
      expect(results).toEqual(mockSearchResults);
      // Access the mocked instance's method directly from embedService
      expect((embedService as any).vectorStore.search).toHaveBeenCalledWith(queryEmbedding, k);
    });
  });

  describe('sendEmbedChat', () => {
    it('should call Criabot about and then post to ragflow model with the model id', async () => {
      // Set up manageService and axios mocks
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: 'mock-bot',
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: 'en-US',
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null,
      });

      // Criabot ABOUT returns effective_config.llm_model_id
      mockedAxios.get.mockResolvedValueOnce({ data: { about: { effective_config: { llm_model_id: 123 } } } } as any);

      // Model about (Criadex) returns 200 (model exists)
      mockedAxios.get.mockResolvedValueOnce({ status: 200 } as any);

      // Post to ragflow should return a valid structure
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          criabot_response: {
            status: 200,
            code: 'SUCCESS',
            message: 'OK',
            reply: {
              verified_response: true,
              related_prompts: [],
              context: null
            }
          },
          message: 'ok'
        }
      } as any);

      const resp = await embedService.sendEmbedChat('mock-bot', 'chat-1', 'hello');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${Config.CRIA_BOT_SERVER_URL}/bots/mock-bot/manage/about`,
        expect.objectContaining({ headers: { 'x-api-key': Config.CRIA_BOT_SERVER_TOKEN } })
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${Config.CRIA_SERVER_URL}/models/ragflow/123/agents/chat`,
        { history: [{ role: 'user', content: 'hello' }], chat_id: 'chat-1' },
        expect.objectContaining({ headers: { 'x-api-key': Config.CRIA_SERVER_TOKEN } })
      );

      expect(resp.status).toBe(200);
    });

    it('should retry model-about when initially 404 and then succeed', async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: 'mock-bot',
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: 'en-US',
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null,
      });

      // First call: Criabot about returns llm_model_id 456
      mockedAxios.get.mockResolvedValueOnce({ data: { about: { effective_config: { llm_model_id: 456 } } } } as any);

      // Next: model about returns 404 then 200
      mockedAxios.get.mockResolvedValueOnce({ status: 404 } as any);
      mockedAxios.get.mockResolvedValueOnce({ status: 200 } as any);

      // Post to ragflow should succeed
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          criabot_response: {
            status: 200,
            code: 'SUCCESS',
            message: 'OK',
            reply: {
              verified_response: true,
              related_prompts: [],
              context: null
            }
          },
          message: 'ok'
        }
      } as any);

      const resp = await embedService.sendEmbedChat('mock-bot', 'chat-2', 'hello again');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${Config.CRIA_SERVER_URL}/models/ragflow/456/agents/chat`,
        { history: [{ role: 'user', content: 'hello again' }], chat_id: 'chat-2' },
        expect.objectContaining({ headers: { 'x-api-key': Config.CRIA_SERVER_TOKEN } })
      );

      expect(resp.status).toBe(200);
    });

    it('should return CriaError 503 if model missing after retries', async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: 'mock-bot',
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: 'en-US',
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null,
      });

      mockedAxios.get.mockResolvedValueOnce({ data: { about: { effective_config: { llm_model_id: 789 } } } } as any);

      // model about returns 404 three times
      mockedAxios.get.mockResolvedValue({ status: 404 } as any);

      await expect(embedService.sendEmbedChat('mock-bot', 'chat-3', 'hi')).rejects.toMatchObject({ payload: { status: 503 } });
    });

    it('should map missing Criabot llm_model_id to 404 after retries', async () => {
      mockManageService.retrieveBot.mockResolvedValueOnce({
        botName: 'mock-bot',
        botEmbedTheme: null,
        botEmbedDefaultEnabled: true,
        botEmbedPosition: 1,
        botWatermark: false,
        botLocale: 'en-US',
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null,
      });

      // Criabot about does not include llm_model_id (empty about)
      mockedAxios.get.mockResolvedValueOnce({ data: { about: {} } } as any);
      mockedAxios.get.mockResolvedValueOnce({ data: { about: {} } } as any);
      mockedAxios.get.mockResolvedValueOnce({ data: { about: {} } } as any);

      await expect(embedService.sendEmbedChat('mock-bot', 'chat-4', 'hi')).rejects.toMatchObject({ payload: { status: 404 } });
    });
  });
});
