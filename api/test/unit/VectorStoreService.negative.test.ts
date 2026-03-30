import { jest } from '@jest/globals';
import { VectorStoreService } from '../../src/services/VectorStoreService';

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

// Mock the Elasticsearch client
jest.mock('@elastic/elasticsearch', () => {
  const mockClient = {
    indices: {
      exists: jest.fn(),
      create: jest.fn(),
    },
    index: jest.fn(),
    search: jest.fn(),
  };
  return {
    Client: jest.fn(() => mockClient),
    __esModule: true,
  };
});

describe('VectorStoreService - Negative Cases', () => {
  let service: VectorStoreService;
  let mockClient: {
    indices: {
      exists: jest.Mock<any>;
      create: jest.Mock<any>;
    };
    index: jest.Mock<any>;
    search: jest.Mock<any>;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VectorStoreService();
    mockClient = (service as any).client;
    mockClient.indices.exists = jest.fn();
    mockClient.indices.create = jest.fn();
    mockClient.index = jest.fn();
    mockClient.search = jest.fn();
  });

  describe('createIndex - Error Handling', () => {
    it('should handle Elasticsearch connection errors', async () => {
      mockClient.indices.exists.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(service.createIndex()).rejects.toThrow('Connection refused');
    });

    it('should handle index creation failures', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(false);
      mockClient.indices.create.mockRejectedValueOnce(new Error('Index creation failed'));

      await expect(service.createIndex()).rejects.toThrow('Index creation failed');
    });

    it('should handle permission errors', async () => {
      const error = new Error('Forbidden');
      (error as any).statusCode = 403;
      mockClient.indices.exists.mockRejectedValueOnce(error);

      await expect(service.createIndex()).rejects.toThrow('Forbidden');
    });
  });

  describe('upsert - Error Handling', () => {
    it('should handle Elasticsearch index errors', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      mockClient.index.mockRejectedValueOnce(new Error('Index error'));

      await expect(
        service.upsert('doc-id', [0.1, 0.2, 0.3], { source: 'test' })
      ).rejects.toThrow('Index error');
    });

    it('should handle invalid embedding dimensions', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      const error = new Error('Invalid embedding dimension');
      (error as any).statusCode = 400;
      mockClient.index.mockRejectedValueOnce(error);

      await expect(
        service.upsert('doc-id', [], { source: 'test' })
      ).rejects.toThrow('Invalid embedding dimension');
    });

    it('should handle document ID conflicts', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      const error = new Error('Document already exists');
      (error as any).statusCode = 409;
      mockClient.index.mockRejectedValueOnce(error);

      await expect(
        service.upsert('existing-doc-id', [0.1, 0.2, 0.3], { source: 'test' })
      ).rejects.toThrow('Document already exists');
    });
  });

  describe('search - Error Handling', () => {
    it('should handle Elasticsearch search errors', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      mockClient.search.mockRejectedValueOnce(new Error('Search query failed'));

      await expect(
        service.search([0.1, 0.2, 0.3], 5)
      ).rejects.toThrow('Search query failed');
    });

    it('should handle invalid query embedding', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      const error = new Error('Invalid query vector dimension');
      (error as any).statusCode = 400;
      mockClient.search.mockRejectedValueOnce(error);

      await expect(
        service.search([], 5)
      ).rejects.toThrow('Invalid query vector dimension');
    });

    it('should handle malformed search response', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      mockClient.search.mockResolvedValueOnce({ hits: null } as any);

      const result = await service.search([0.1, 0.2, 0.3], 5);
      expect(result).toEqual([]);
    });

    it('should handle search timeout', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).statusCode = 408;
      mockClient.search.mockRejectedValueOnce(timeoutError);

      await expect(
        service.search([0.1, 0.2, 0.3], 5)
      ).rejects.toThrow('Request timeout');
    });
  });

  describe('indexExists - Error Handling', () => {
    it('should handle connection errors when checking index', async () => {
      mockClient.indices.exists.mockRejectedValueOnce(new Error('Connection error'));

      await expect(service.indexExists()).rejects.toThrow('Connection error');
    });

    it('should handle authentication errors', async () => {
      const error = new Error('Unauthorized');
      (error as any).statusCode = 401;
      mockClient.indices.exists.mockRejectedValueOnce(error);

      await expect(service.indexExists()).rejects.toThrow('Unauthorized');
    });
  });
});
