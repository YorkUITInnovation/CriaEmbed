import MessageCache from '../../src/database/redis/controllers/MessageCache';

// Mock ioredis globally (already done in jest.setup.ts, but good to be explicit for context)
jest.mock('ioredis', () => {
  const Redis = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn(),
  }));
  return Redis;
});


describe('MessageCache', () => {
  let messageCache: MessageCache;
  let mockRedisClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    messageCache = new MessageCache();
    // Manually mock the redis property after instantiation
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
    };
    (messageCache as any).redis = mockRedisClient;
  });

  it('should be defined', () => {
    expect(messageCache).toBeDefined();
  });

  describe('set', () => {
    it('should set a message with a generated ID', async () => {
      const chatId = 'testChatId';
      const message = 'Hello, world!';

      await messageCache.set(chatId, message);

      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
      const callArgs = mockRedisClient.set.mock.calls[0];
      expect(callArgs[0]).toMatch(/^cria-embed:chats:testChatId:messages:message-/);
      expect(callArgs[1]).toBe(message);
      expect(callArgs[2]).toBe('EX');
      expect(callArgs[3]).toBe(1000 * 60 * 60 * 6);
    });

    it('should set a message with a provided botGreetingId', async () => {
      const chatId = 'testChatId';
      const message = 'Welcome!';
      const botGreetingId = 'greeting123';

      const resultId = await messageCache.set(chatId, message, botGreetingId);

      expect(resultId).toBe(botGreetingId);
      expect(mockRedisClient.set).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `cria-embed:chats:${chatId}:messages:${botGreetingId}`,
        message,
        'EX',
        1000 * 60 * 60 * 6
      );
    });
  });

  describe('get', () => {
    it('should retrieve an existing message', async () => {
      const chatId = 'testChatId';
      const messageId = 'message-abc';
      const storedMessage = 'Stored message content';
      mockRedisClient.get.mockResolvedValueOnce(storedMessage);

      const result = await messageCache.get(chatId, messageId);

      expect(result).toBe(storedMessage);
      expect(mockRedisClient.get).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`cria-embed:chats:${chatId}:messages:${messageId}`);
    });

    it('should return null for a non-existent message', async () => {
      const chatId = 'testChatId';
      const messageId = 'nonExistentMessage';
      mockRedisClient.get.mockResolvedValueOnce(null);

      const result = await messageCache.get(chatId, messageId);

      expect(result).toBeNull();
      expect(mockRedisClient.get).toHaveBeenCalledTimes(1);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`cria-embed:chats:${chatId}:messages:${messageId}`);
    });
  });
});
