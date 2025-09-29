import { VectorStoreService } from '../../src/services/VectorStoreService';
import { Client } from '@elastic/elasticsearch';

// Mock the Elasticsearch client
jest.mock('@elastic/elasticsearch', () => ({
  Client: jest.fn(() => ({
    indices: {
      exists: jest.fn() as jest.Mock,
      create: jest.fn() as jest.Mock,
    },
    index: jest.fn() as jest.Mock,
    search: jest.fn() as jest.Mock,
  })),
}));

describe('VectorStoreService', () => {
  let service: VectorStoreService;
  let mockClient: {
    indices: {
      exists: jest.Mock;
      create: jest.Mock;
    };
    index: jest.Mock;
    search: jest.Mock;
  };

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Re-initialize the service for each test
    service = new VectorStoreService();
    // Explicitly cast the nested properties to Jest mock functions
    mockClient = {
      indices: {
        exists: (service as any).client.indices.exists as jest.Mock,
        create: (service as any).client.indices.create as jest.Mock,
      },
      index: (service as any).client.index as jest.Mock,
      search: (service as any).client.search as jest.Mock,
    };
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize the Elasticsearch client with correct config', () => {
    expect(Client).toHaveBeenCalledTimes(1);
    expect(Client).toHaveBeenCalledWith({
      node: `http://localhost:9200`,
      auth: undefined, // Assuming no auth for test environment
    });
    expect((service as any).index).toBe('test_criaembed');
  });

  describe('indexExists', () => {
    it('should return true if index exists', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      const exists = await service.indexExists();
      expect(exists).toBe(true);
      expect(mockClient.indices.exists).toHaveBeenCalledTimes(1);
      expect(mockClient.indices.exists).toHaveBeenCalledWith({ index: (service as any).index });
    });

    it('should return false if index does not exist', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(false);
      const exists = await service.indexExists();
      expect(exists).toBe(false);
      expect(mockClient.indices.exists).toHaveBeenCalledTimes(1);
      expect(mockClient.indices.exists).toHaveBeenCalledWith({ index: (service as any).index });
    });
  });

  describe('createIndex', () => {
    it('should create an index if it does not exist', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(false);
      await service.createIndex();
      expect(mockClient.indices.create).toHaveBeenCalledTimes(1);
      expect(mockClient.indices.create).toHaveBeenCalledWith({
        index: (service as any).index,
        mappings: {
          properties: {
            embedding: { type: "dense_vector", dims: 768 },
            metadata: { type: "object" }
          }
        }
      });
    });

    it('should not create an index if it already exists', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      await service.createIndex();
      expect(mockClient.indices.create).not.toHaveBeenCalled();
    });
  });

  describe('upsert', () => {
    it('should call index on the client with correct parameters', async () => {
      mockClient.indices.exists.mockResolvedValue(true); // Assume index exists for upsert
      const id = 'test-id';
      const embedding = [0.1, 0.2, 0.3];
      const metadata = { key: 'value' };

      await service.upsert(id, embedding, metadata);

      expect(mockClient.index).toHaveBeenCalledTimes(1);
      expect(mockClient.index).toHaveBeenCalledWith({
        index: (service as any).index,
        id,
        body: {
          embedding,
          metadata,
        },
      });
    });

    it('should create index if it does not exist before upserting', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(false); // Index does not exist initially
      mockClient.indices.exists.mockResolvedValueOnce(true);  // Index exists after creation

      const id = 'test-id';
      const embedding = [0.1, 0.2, 0.3];
      const metadata = { key: 'value' };

      await service.upsert(id, embedding, metadata);

      expect(mockClient.indices.create).toHaveBeenCalledTimes(1);
      expect(mockClient.index).toHaveBeenCalledTimes(1);
    });
  });

  describe('search', () => {
    it('should call search on the client with correct parameters', async () => {
      mockClient.indices.exists.mockResolvedValue(true); // Assume index exists for search
      const queryEmbedding = [0.1, 0.2, 0.3];
      const k = 5;
      const mockHits = [{ _id: 'doc1', _source: { metadata: {}} }];
      mockClient.search.mockResolvedValueOnce({ hits: { hits: mockHits } } as any);

      const result = await service.search(queryEmbedding, k);

      expect(mockClient.search).toHaveBeenCalledTimes(1);
      expect(mockClient.search).toHaveBeenCalledWith({
        index: (service as any).index,
        size: k,
        query: {
          script_score: {
            query: { match_all: {} },
            script: {
              source: `cosineSimilarity(params.query_vector, 'embedding') + 1.0`,
              params: { query_vector: queryEmbedding },
            },
          },
        },
      });
      expect(result).toEqual(mockHits);
    });

    it('should create index if it does not exist before searching', async () => {
      mockClient.indices.exists.mockResolvedValueOnce(false); // Index does not exist initially
      mockClient.indices.exists.mockResolvedValueOnce(true);  // Index exists after creation

      const queryEmbedding = [0.1, 0.2, 0.3];
      const k = 5;
      mockClient.search.mockResolvedValueOnce({ hits: { hits: [] } } as any);

      await service.search(queryEmbedding, k);

      expect(mockClient.indices.create).toHaveBeenCalledTimes(1);
      expect(mockClient.search).toHaveBeenCalledTimes(1);
    });

    it('should return an empty array if no hits are found', async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.search.mockResolvedValueOnce({ hits: { hits: [] } } as any);

      const result = await service.search([0.1, 0.2, 0.3]);

      expect(result).toEqual([]);
    });

    it('should return an empty array if hits is undefined', async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.search.mockResolvedValueOnce({} as any);

      const result = await service.search([0.1, 0.2, 0.3]);

      expect(result).toEqual([]);
    });
  });
});