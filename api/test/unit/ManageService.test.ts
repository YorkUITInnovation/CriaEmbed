// Explicitly mock ../config first to ensure BaseService gets the mocked version
jest.mock('../../src/config', () => ({
  Config: {
    CRIA_BOT_SERVER_URL: process.env.CRIA_BOT_SERVER_URL,
    CRIA_BOT_SERVER_TOKEN: process.env.CRIA_BOT_SERVER_TOKEN,
    CRIA_SERVER_URL: process.env.CRIA_SERVER_URL,
    CRIA_SERVER_TOKEN: process.env.CRIA_SERVER_TOKEN,
    WEB_APP_URL: process.env.WEB_APP_URL,
    THIS_APP_URL: process.env.THIS_APP_URL,
    ASSETS_FOLDER_PATH: process.env.ASSETS_FOLDER_PATH,
    DEFAULT_BOT_GREETING: process.env.DEFAULT_BOT_GREETING,
    ELASTICSEARCH_HOST: process.env.ELASTICSEARCH_HOST,
    ELASTICSEARCH_PORT: process.env.ELASTICSEARCH_PORT,
    ELASTICSEARCH_INDEX: process.env.ELASTICSEARCH_INDEX,
    RAGFLOW_EMBED_DIM: process.env.RAGFLOW_EMBED_DIM,
    DEBUG_ENABLED: process.env.DEBUG_ENABLED,
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    MYSQL_PORT: process.env.MYSQL_PORT,
    MYSQL_HOST: process.env.MYSQL_HOST,
    MYSQL_USERNAME: process.env.MYSQL_USERNAME,
    MYSQL_DATABASE: process.env.MYSQL_DATABASE,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_USERNAME: process.env.REDIS_USERNAME,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    RATE_LIMIT_EMBED_MINUTE_MAX: process.env.RATE_LIMIT_EMBED_MINUTE_MAX,
    RATE_LIMIT_EMBED_HOUR_MAX: process.env.RATE_LIMIT_EMBED_HOUR_MAX,
    RATE_LIMIT_EMBED_DAY_MAX: process.env.RATE_LIMIT_EMBED_DAY_MAX,
    RATE_LIMIT_CHAT_MINUTE_MAX: process.env.RATE_LIMIT_CHAT_MINUTE_MAX,
    RATE_LIMIT_CHAT_HOUR_MAX: process.env.RATE_LIMIT_CHAT_HOUR_MAX,
    RATE_LIMIT_CHAT_DAY_MAX: process.env.RATE_LIMIT_CHAT_DAY_MAX,
    APP_MODE: process.env.APP_MODE,
    ELASTICSEARCH_USERNAME: process.env.ELASTICSEARCH_USERNAME,
    ELASTICSEARCH_PASSWORD: process.env.ELASTICSEARCH_PASSWORD,
    RAGFLOW_INDEX_NAME: process.env.RAGFLOW_INDEX_NAME,
  },
  debugEnabled: jest.fn(() => process.env.DEBUG_ENABLED?.toLowerCase() === "true"),
}));

import { ManageService, BotNotFoundError, UnauthorizedError, EmbedNotFoundError, DuplicateEmbedError } from '../../src/services/ManageService';
import { Config } from '../../src/config'; // Keep import for type information
import { BotEmbed, IBotEmbed, IBotEmbedConfig } from '../../src/database/mysql/controllers/BotEmbed';
import axios from 'axios';

// Mock mysql2 Pool
jest.mock('mysql2', () => ({
  createPool: jest.fn(() => ({
    getConnection: jest.fn((callback) => callback(null, { release: jest.fn() })),
    end: jest.fn(),
  })),
}));

// Mock BotEmbed
jest.mock('../../src/database/mysql/controllers/BotEmbed');
const MockedBotEmbed = BotEmbed as jest.MockedClass<typeof BotEmbed>;

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;


describe('ManageService', () => {
  let manageService: ManageService;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the constructor of BotEmbed
    MockedBotEmbed.mockImplementation(() => ({
      retrieveByName: jest.fn(),
      retrieveByAppId: jest.fn(),
      existsByName: jest.fn(),
      insert: jest.fn(),
      removeByName: jest.fn(),
      update: jest.fn(),
    })) as any;

    // Create a mock pool for the ManageService constructor
    mockPool = {
      getConnection: jest.fn((callback) => callback(null, { release: jest.fn() })),
      end: jest.fn(),
    };

  // Inject mocked Config
  const mockedConfig = require('../../src/config').Config;
  manageService = new ManageService(mockPool, mockedConfig);

    // Reset axios mocks
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();

    // Config values are now mocked via jest.mock('../../src/config')
    // No need to set them directly here anymore
  });

  it('should be defined', () => {
    expect(manageService).toBeDefined();
  });

  describe('botExistsAndIsAuthorized', () => {
    const botName = 'testBot';
    const apiKey = 'testApiKey';

    it('should return true if bot exists and is authorized', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: {} }) // bot exists
        .mockResolvedValueOnce({ status: 200, data: { authorized: true } }); // authorized

      await expect(manageService.botExistsAndIsAuthorized(botName, apiKey)).resolves.toBe(true);

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${Config.CRIA_BOT_SERVER_URL}/groups/${botName}/about`,
        expect.objectContaining({ headers: { 'x-api-key': Config.CRIA_BOT_SERVER_TOKEN }, validateStatus: expect.any(Function) })
      );
      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${Config.CRIA_BOT_SERVER_URL}/auth/${apiKey}/check`,
        expect.objectContaining({ headers: { 'x-api-key': Config.CRIA_BOT_SERVER_TOKEN }, validateStatus: expect.any(Function) })
      );
    });

    it('should throw BotNotFoundError if bot does not exist', async () => {
      mockedAxios.get.mockResolvedValueOnce({ status: 404 }); // bot does not exist

      await expect(manageService.botExistsAndIsAuthorized(botName, apiKey)).rejects.toThrow(BotNotFoundError);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedError if not authorized', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: {} }) // bot exists
        .mockResolvedValueOnce({ status: 200, data: { authorized: false } }); // not authorized

      await expect(manageService.botExistsAndIsAuthorized(botName, apiKey)).rejects.toThrow(UnauthorizedError);
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('existsBot', () => {
    const botName = 'testBot';

    it('should return true if bot exists', async () => {
  (manageService.db.retrieveByName as jest.Mock).mockResolvedValueOnce({ botName: botName });
  await expect(manageService.existsBot(botName)).resolves.toBe(true);
  expect(manageService.db.retrieveByName).toHaveBeenCalledWith(botName);
    });

    it('should return false if bot does not exist', async () => {
  (manageService.db.retrieveByName as jest.Mock).mockResolvedValueOnce(undefined);
  await expect(manageService.existsBot(botName)).resolves.toBe(false);
  expect(manageService.db.retrieveByName).toHaveBeenCalledWith(botName);
    });
  });

  describe('retrieveBot', () => {
    const botName = 'testBot';
    const apiKey = 'testApiKey';
    const mockBot: IBotEmbed = { id: 1, botName: botName, botTitle: 'Test Bot', botGreeting: 'Hello' };

    it('should retrieve bot with authorization', async () => {
      // Mock botExistsAndIsAuthorized to pass
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockResolvedValueOnce(true);
  (manageService.db.retrieveByName as jest.Mock).mockResolvedValueOnce(mockBot);

      await expect(manageService.retrieveBot(botName, apiKey, false)).resolves.toEqual(mockBot);
      expect(manageService.botExistsAndIsAuthorized).toHaveBeenCalledWith(botName, apiKey);
  expect(manageService.db.retrieveByName).toHaveBeenCalledWith(botName);
    });

    it('should retrieve bot skipping authorization', async () => {
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockResolvedValueOnce(true);
  (manageService.db.retrieveByName as jest.Mock).mockResolvedValueOnce(mockBot);

      await expect(manageService.retrieveBot(botName, apiKey, true)).resolves.toEqual(mockBot);
      expect(manageService.botExistsAndIsAuthorized).not.toHaveBeenCalled();
  expect(manageService.db.retrieveByName).toHaveBeenCalledWith(botName);
    });

    it('should throw EmbedNotFoundError if bot not found', async () => {
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockResolvedValueOnce(true);
  (manageService.db.retrieveByName as jest.Mock).mockResolvedValueOnce(undefined);

      await expect(manageService.retrieveBot(botName, apiKey, false)).rejects.toThrow(EmbedNotFoundError);
    });

    it('should throw UnauthorizedError if authorization fails', async () => {
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockRejectedValueOnce(new UnauthorizedError());

      await expect(manageService.retrieveBot(botName, apiKey, false)).rejects.toThrow(UnauthorizedError);
      expect(manageService.botExistsAndIsAuthorized).toHaveBeenCalledWith(botName, apiKey);
    });
  });

  describe('retrieveBotByMicrosoftAppId', () => {
    const microsoftAppId = 'testAppId';
    const mockBot: IBotEmbed = { id: 1, botName: 'testBot', botTitle: 'Test Bot', botGreeting: 'Hello' };

    it('should retrieve bot by Microsoft App ID', async () => {
  (manageService.db.retrieveByAppId as jest.Mock).mockResolvedValueOnce(mockBot);

      await expect(manageService.retrieveBotByMicrosoftAppId(microsoftAppId)).resolves.toEqual(mockBot);
  expect(manageService.db.retrieveByAppId).toHaveBeenCalledWith(microsoftAppId);
    });

    it('should throw EmbedNotFoundError if bot not found', async () => {
  (manageService.db.retrieveByAppId as jest.Mock).mockResolvedValueOnce(undefined);

      await expect(manageService.retrieveBotByMicrosoftAppId(microsoftAppId)).rejects.toThrow(EmbedNotFoundError);
    });

    it('should rethrow error from db.retrieveByAppId', async () => {
      const dbError = new Error('DB connection failed');
  (manageService.db.retrieveByAppId as jest.Mock).mockRejectedValueOnce(dbError);

      await expect(manageService.retrieveBotByMicrosoftAppId(microsoftAppId)).rejects.toThrow(dbError);
    });
  });

  describe('insertBot', () => {
    const mockConfig: IBotEmbedConfig = { botName: 'newBot', botTitle: 'New Bot' };
    const apiKey = 'testApiKey';
    const insertedBot: IBotEmbed = { id: 2, ...mockConfig, botGreeting: 'Hi' };

    it('should insert a new bot', async () => {
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockResolvedValueOnce(true);
  (manageService.db.existsByName as jest.Mock).mockResolvedValueOnce(false);
  (manageService.db.insert as jest.Mock).mockResolvedValueOnce(insertedBot);

      await expect(manageService.insertBot(mockConfig, apiKey)).resolves.toEqual(insertedBot);
      expect(manageService.botExistsAndIsAuthorized).toHaveBeenCalledWith(mockConfig.botName, apiKey);
  expect(manageService.db.existsByName).toHaveBeenCalledWith(mockConfig.botName);
  expect(manageService.db.insert).toHaveBeenCalledWith(mockConfig);
    });

    it('should throw DuplicateEmbedError if bot already exists', async () => {
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockResolvedValueOnce(true);
  (manageService.db.existsByName as jest.Mock).mockResolvedValueOnce(true);

      await expect(manageService.insertBot(mockConfig, apiKey)).rejects.toThrow(DuplicateEmbedError);
    });

    it('should throw UnauthorizedError if authorization fails', async () => {
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockRejectedValueOnce(new UnauthorizedError());

      await expect(manageService.insertBot(mockConfig, apiKey)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('deleteBot', () => {
    const botName = 'botToDelete';
    const apiKey = 'testApiKey';

    it('should delete a bot', async () => {
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockResolvedValueOnce(true);
  (manageService.db.existsByName as jest.Mock).mockResolvedValueOnce(true);
  (manageService.db.removeByName as jest.Mock).mockResolvedValueOnce(1);

      await expect(manageService.deleteBot(botName, apiKey)).resolves.toBe(1);
      expect(manageService.botExistsAndIsAuthorized).toHaveBeenCalledWith(botName, apiKey);
  expect(manageService.db.existsByName).toHaveBeenCalledWith(botName);
  expect(manageService.db.removeByName).toHaveBeenCalledWith(botName);
    });

    it('should throw EmbedNotFoundError if bot does not exist', async () => {
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockResolvedValueOnce(true);
  (manageService.db.existsByName as jest.Mock).mockResolvedValueOnce(false);

      await expect(manageService.deleteBot(botName, apiKey)).rejects.toThrow(EmbedNotFoundError);
    });

    it('should throw UnauthorizedError if authorization fails', async () => {
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockRejectedValueOnce(new UnauthorizedError());

      await expect(manageService.deleteBot(botName, apiKey)).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('updateBot', () => {
    const mockConfig: IBotEmbedConfig = { botName: 'updatedBot', botTitle: 'Updated Bot' };
    const apiKey = 'testApiKey';
    const updatedBot: IBotEmbed = { id: 3, ...mockConfig, botGreeting: 'Hi again' };

    it('should update a bot', async () => {
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockResolvedValueOnce(true);
  (manageService.db.update as jest.Mock).mockResolvedValueOnce(updatedBot);

      await expect(manageService.updateBot(mockConfig, apiKey)).resolves.toEqual(updatedBot);
      expect(manageService.botExistsAndIsAuthorized).toHaveBeenCalledWith(mockConfig.botName, apiKey);
  expect(manageService.db.update).toHaveBeenCalledWith(mockConfig);
    });

    it('should throw EmbedNotFoundError if bot not found', async () => {
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockResolvedValueOnce(true);
  (manageService.db.update as jest.Mock).mockResolvedValueOnce(undefined);

      await expect(manageService.updateBot(mockConfig, apiKey)).rejects.toThrow(EmbedNotFoundError);
    });

    it('should throw UnauthorizedError if authorization fails', async () => {
      jest.spyOn(manageService, 'botExistsAndIsAuthorized').mockRejectedValueOnce(new UnauthorizedError());

      await expect(manageService.updateBot(mockConfig, apiKey)).rejects.toThrow(UnauthorizedError);
    });
  });
});