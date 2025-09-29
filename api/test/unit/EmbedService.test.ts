import { EmbedService } from '../../src/services/EmbedService';
import { VectorStoreService } from '../../src/services/VectorStoreService';
import axios from 'axios';
import { Config } from '../../src/config';
import { ManageService } from '../../src/services/ManageService';
import MessageCache from '../../src/database/redis/controllers/MessageCache';
import TrackingCache from '../../src/database/redis/controllers/TrackingCache';

// Mock VectorStoreService
jest.mock('../../src/services/VectorStoreService');

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock ManageService
jest.mock('../../src/services/ManageService');

// Mock MessageCache
jest.mock('../../src/database/redis/controllers/MessageCache');

// Mock TrackingCache
jest.mock('../../src/database/redis/controllers/TrackingCache');

describe('EmbedService', () => {
  let embedService: EmbedService;
  let mockVectorStoreService: jest.Mocked<VectorStoreService>;
  let mockManageService: jest.Mocked<ManageService>;
  let mockMessageCache: jest.Mocked<MessageCache>;
  let mockTrackingCache: jest.Mocked<TrackingCache>;

  beforeEach(() => {
    jest.clearAllMocks();
    embedService = new EmbedService();
    mockVectorStoreService = (VectorStoreService as jest.Mock).mock.instances[0] as jest.Mocked<VectorStoreService>;
    mockManageService = (ManageService as jest.Mock).mock.instances[0] as jest.Mocked<ManageService>;
    mockMessageCache = (MessageCache as jest.Mock).mock.instances[0] as jest.Mocked<MessageCache>;
    mockTrackingCache = (TrackingCache as jest.Mock).mock.instances[0] as jest.Mocked<TrackingCache>;
  });

  it('should be defined', () => {
    expect(embedService).toBeDefined();
  });

  it('should initialize VectorStoreService', () => {
    expect(VectorStoreService).toHaveBeenCalledTimes(1);
  });

  describe('createChat', () => {
    it('should return a chat ID on successful API call', async () => {
      const mockChatId = 'test-chat-id';
      mockedAxios.post.mockResolvedValueOnce({ data: mockChatId });

      const chatId = await embedService.createChat();

      expect(chatId).toBe(mockChatId);
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${Config.CRIA_BOT_SERVER_URL}/cria_get_chat_id?x-api-key=${Config.CRIA_BOT_SERVER_TOKEN}`,
        {}
      );
    });

    it('should throw an error if API call fails', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: null });

      await expect(embedService.createChat()).rejects.toThrow('Failed to receive a Chat ID!');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('upsertEmbedding', () => {
    it('should call vectorStore.upsert with correct parameters', async () => {
      const id = 'doc-id';
      const embedding = [0.1, 0.2, 0.3];
      const metadata = { source: 'test' };

      await embedService.upsertEmbedding(id, embedding, metadata);

      expect(mockVectorStoreService.upsert).toHaveBeenCalledTimes(1);
      expect(mockVectorStoreService.upsert).toHaveBeenCalledWith(id, embedding, metadata);
    });
  });

  describe('searchEmbeddings', () => {
    it('should call vectorStore.search with correct parameters', async () => {
      const queryEmbedding = [0.4, 0.5, 0.6];
      const k = 5;
      const mockSearchResults = [{ id: 'doc-id', score: 0.9 }];
      mockVectorStoreService.search.mockResolvedValueOnce(mockSearchResults);

      const results = await embedService.searchEmbeddings(queryEmbedding, k);

      expect(results).toEqual(mockSearchResults);
      expect(mockVectorStoreService.search).toHaveBeenCalledTimes(1);
      expect(mockVectorStoreService.search).toHaveBeenCalledWith(queryEmbedding, k);
    });
  });

  describe('sendChat', () => {
    it('should call the correct API endpoint and return response', async () => {
      const mockBotId = 'test-bot';
      const mockChatId = 'test-chat';
      const mockPrompt = 'Hello';
      const mockApiResponse = {
        criabot_response: JSON.stringify({ status: 200, message: 'Reply', code: 'SUCCESS', reply: { related_prompts: [] } }),
        message: 'Reply',
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockApiResponse });

      const response = await (embedService as any).sendChat(mockBotId, mockChatId, mockPrompt);

      expect(response).toEqual({
        criabot_response: { status: 200, message: 'Reply', code: 'SUCCESS', reply: { related_prompts: [] } },
        message: 'Reply',
      });
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        `${Config.CRIA_BOT_SERVER_URL}/cria_get_gpt_response?x-api-key=${Config.CRIA_BOT_SERVER_TOKEN}`,
        {
          bot_id: mockBotId,
          chat_id: mockChatId,
          prompt: mockPrompt,
          filters: '',
        }
      );
    });
  });

  describe('retrieveEmbedConfig', () => {
    it('should retrieve and format bot configuration', async () => {
      const mockBotName = 'test-bot';
      const mockChatId = 'test-chat';
      const mockBotConfig = {
        botName: mockBotName,
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
      };
      mockManageService.retrieveBot.mockResolvedValueOnce(mockBotConfig as any);
      mockMessageCache.get.mockResolvedValueOnce(null);

      const config = await embedService.retrieveEmbedConfig(mockChatId, mockBotName);

      expect(config).toEqual({
        botId: mockBotName,
        botName: 'Test Bot',
        botSubName: 'A sub title',
        botGreeting: 'Hi there!',
        botGreetingId: 'greeting',
        botIconUrl: 'http://icon.url/icon.png',
        embedTheme: '#FFFFFF',
        defaultEnabled: true,
        embedPosition: 'BL',
        watermarkEnabled: false,
        botLocale: 'en-US',
        initialPrompts: [],
        botTrustWarning: null,
        botContact: null,
      });
      expect(mockManageService.retrieveBot).toHaveBeenCalledTimes(1);
      expect(mockMessageCache.get).toHaveBeenCalledTimes(1);
      expect(mockMessageCache.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendEmbedChat', () => {
    it('should send chat and return formatted response', async () => {
      const mockBotName = 'test-bot';
      const mockChatId = 'test-chat';
      const mockPrompt = 'Hello';
      const mockApiResponse = {
        criabot_response: JSON.stringify({
          status: 200,
          message: 'Bot reply',
          code: 'SUCCESS',
          reply: { related_prompts: [{ label: 'prompt1', prompt: 'p1' }], context: null, verified_response: true },
        }),
        message: 'Bot reply',
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockApiResponse });
      mockMessageCache.set.mockResolvedValueOnce('reply-id');

      const response = await embedService.sendEmbedChat(mockBotName, mockChatId, mockPrompt);

      expect(response).toEqual({
        message: 'Bot reply',
        status: 200,
        code: 'SUCCESS',
        timestamp: expect.any(String),
        reply: 'Bot reply',
        replyId: 'reply-id',
        relatedPrompts: [{ label: 'prompt1', prompt: 'p1' }],
        verifiedResponse: true,
      });
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockMessageCache.set).toHaveBeenCalledTimes(1);
    });

    it('should handle error response from criabot', async () => {
      const mockBotName = 'test-bot';
      const mockChatId = 'test-chat';
      const mockPrompt = 'Hello';
      const mockApiResponse = {
        criabot_response: JSON.stringify({
          status: 500,
          message: 'Internal Server Error',
          code: 'ERROR',
          reply: null,
        }),
        message: null,
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockApiResponse });

      const response = await embedService.sendEmbedChat(mockBotName, mockChatId, mockPrompt);

      expect(response).toEqual({
        message: 'Internal Server Error',
        status: 500,
        code: 'ERROR',
        timestamp: expect.any(String),
        reply: null,
        replyId: null,
        relatedPrompts: null,
        verifiedResponse: null,
      });
    });
  });

  describe('saveTrackingInfo', () => {
    it('should call manageService.botExistsAndIsAuthorized and trackingCache.set', async () => {
      const botName = 'test-bot';
      const chatId = 'test-chat';
      const sessionData = { key: 'value' };
      const apiKey = 'test-api-key';
      mockManageService.botExistsAndIsAuthorized.mockResolvedValueOnce(true);
      mockTrackingCache.set.mockResolvedValueOnce('tracking-id');

      const result = await embedService.saveTrackingInfo(botName, chatId, sessionData, apiKey);

      expect(mockManageService.botExistsAndIsAuthorized).toHaveBeenCalledTimes(1);
      expect(mockManageService.botExistsAndIsAuthorized).toHaveBeenCalledWith(botName, apiKey);
      expect(mockTrackingCache.set).toHaveBeenCalledTimes(1);
      expect(mockTrackingCache.set).toHaveBeenCalledWith(chatId, sessionData);
      expect(result).toBe('tracking-id');
    });
  });

  describe('transferTrackingInfo', () => {
    it('should transfer tracking info from previous chat to new chat', async () => {
      const previousChatId = 'old-chat';
      const newChatId = 'new-chat';
      const trackingData = { some: 'data' };
      mockTrackingCache.get.mockResolvedValueOnce(trackingData);
      mockTrackingCache.set.mockResolvedValueOnce('new-tracking-id');

      await embedService.transferTrackingInfo(previousChatId, newChatId);

      expect(mockTrackingCache.get).toHaveBeenCalledTimes(1);
      expect(mockTrackingCache.get).toHaveBeenCalledWith(previousChatId);
      expect(mockTrackingCache.set).toHaveBeenCalledTimes(1);
      expect(mockTrackingCache.set).toHaveBeenCalledWith(newChatId, trackingData);
    });
  });

  describe('getTrackingInfo', () => {
    it('should call manageService.botExistsAndIsAuthorized and trackingCache.get', async () => {
      const botName = 'test-bot';
      const chatId = 'test-chat';
      const apiKey = 'test-api-key';
      const trackingData = { some: 'data' };
      mockManageService.botExistsAndIsAuthorized.mockResolvedValueOnce(true);
      mockTrackingCache.get.mockResolvedValueOnce(trackingData);

      const result = await embedService.getTrackingInfo(botName, chatId, apiKey);

      expect(mockManageService.botExistsAndIsAuthorized).toHaveBeenCalledTimes(1);
      expect(mockManageService.botExistsAndIsAuthorized).toHaveBeenCalledWith(botName, apiKey);
      expect(mockTrackingCache.get).toHaveBeenCalledTimes(1);
      expect(mockTrackingCache.get).toHaveBeenCalledWith(chatId);
      expect(result).toBe(trackingData);
    });
  });

  describe('existsEmbedChat', () => {
    it('should return true if chat exists', async () => {
      const chatId = 'test-chat';
      mockedAxios.get.mockResolvedValueOnce({ data: { code: 'SUCCESS', exists: true } });

      const exists = await embedService.existsEmbedChat(chatId);

      expect(exists).toBe(true);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${Config.CRIA_BOT_SERVER_URL}/bots/chats/${chatId}/exists?x-api-key=${Config.CRIA_BOT_SERVER_TOKEN}`
      );
    });

    it('should return false if chat does not exist', async () => {
      const chatId = 'test-chat';
      mockedAxios.get.mockResolvedValueOnce({ data: { code: 'SUCCESS', exists: false } });

      const exists = await embedService.existsEmbedChat(chatId);

      expect(exists).toBe(false);
    });

    it('should throw CriaError if API call returns non-SUCCESS code', async () => {
      const chatId = 'test-chat';
      mockedAxios.get.mockResolvedValueOnce({ data: { code: 'ERROR', message: 'API Error' } });

      await expect(embedService.existsEmbedChat(chatId)).rejects.toThrow('Error: {"code":"ERROR","message":"API Error"}');
    });

    it('should throw CriaError if exists is null or undefined', async () => {
      const chatId = 'test-chat';
      mockedAxios.get.mockResolvedValueOnce({ data: { code: 'SUCCESS', exists: null } });

      await expect(embedService.existsEmbedChat(chatId)).rejects.toThrow('Error: Response shows undefined exists. Payload read error?');
    });
  });
});