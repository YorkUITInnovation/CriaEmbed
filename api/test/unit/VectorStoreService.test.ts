import { jest } from "@jest/globals";
import { VectorStoreService } from "../../src/services/VectorStoreService";

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

// Mock the Elasticsearch client
jest.mock("@elastic/elasticsearch", () => {
  // All methods are Jest mock functions
  const mockClient = {
    indices: {
      exists: jest.fn(),
      create: jest.fn(),
      putMapping: jest.fn()
    },
    index: jest.fn(),
    search: jest.fn(),
    count: jest.fn()
  };
  return {
    Client: jest.fn(() => mockClient),
    __esModule: true
  };
});

describe("VectorStoreService", () => {
  let service: VectorStoreService;
  let mockClient: {
    indices: {
      exists: jest.Mock<any>;
      create: jest.Mock<any>;
      putMapping: jest.Mock<any>;
    };
    index: jest.Mock<any>;
    search: jest.Mock<any>;
    count: jest.Mock<any>;
  };
  let MockedClient: jest.Mock<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VectorStoreService();
    mockClient = (service as any).client;
    MockedClient = jest.requireMock("@elastic/elasticsearch").Client;
    // Explicitly assign jest.fn() to all mock methods
    mockClient.indices.exists = jest.fn();
    mockClient.indices.create = jest.fn();
    mockClient.indices.putMapping = jest.fn();
    mockClient.index = jest.fn();
    mockClient.search = jest.fn();
    mockClient.count = jest.fn().mockResolvedValue({ count: 0 });
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should initialize the Elasticsearch client with correct config", () => {
    expect(MockedClient).toHaveBeenCalledTimes(1);
    expect(MockedClient).toHaveBeenCalledWith({
      node: `http://localhost:9200`,
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
      }
    });
    expect((service as any).index).toBe("test_criaembed");
  });

  describe("indexExists", () => {
    it("should return true if index exists", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      const exists = await service.indexExists();
      expect(exists).toBe(true);
      expect(mockClient.indices.exists).toHaveBeenCalledTimes(1);
      expect(mockClient.indices.exists).toHaveBeenCalledWith({
        index: (service as any).index
      });
    });

    it("should return false if index does not exist", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(false);
      const exists = await service.indexExists();
      expect(exists).toBe(false);
      expect(mockClient.indices.exists).toHaveBeenCalledTimes(1);
      expect(mockClient.indices.exists).toHaveBeenCalledWith({
        index: (service as any).index
      });
    });
  });

  describe("createIndex", () => {
    it("should create an index if it does not exist", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(false);
      await service.createIndex();
      expect(mockClient.indices.create).toHaveBeenCalledTimes(1);
      expect(mockClient.indices.create).toHaveBeenCalledWith({
        index: (service as any).index,
        mappings: {
          properties: {
            embedding: { type: "dense_vector", dims: 768 },
            metadata: {
              type: "object",
              properties: {
                botNamespace: { type: "keyword" }
              }
            }
          }
        }
      });
    });

    it("should not create an index if it already exists", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      await service.createIndex();
      expect(mockClient.indices.create).not.toHaveBeenCalled();
      expect(mockClient.indices.putMapping).toHaveBeenCalledWith({
        index: "test_criaembed",
        properties: {
          metadata: {
            type: "object",
            properties: { botNamespace: { type: "keyword" } }
          }
        }
      });
    });
  });

  describe("upsert", () => {
    it("should call index on the client with correct parameters", async () => {
      mockClient.indices.exists.mockResolvedValue(true); // Assume index exists for upsert
      const id = "test-id";
      const embedding = Array(768).fill(0.1);
      const metadata = { key: "value" };

      await service.upsert("bot-1", id, embedding, metadata);

      expect(mockClient.index).toHaveBeenCalledTimes(1);
      expect(mockClient.index).toHaveBeenCalledWith({
        index: (service as any).index,
        id: "bot-1:test-id",
        body: {
          embedding,
          metadata: {
            ...metadata,
            botNamespace: "bot-1"
          }
        }
      });
    });

    it("should create index if it does not exist before upserting", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(false); // Index does not exist initially
      mockClient.indices.exists.mockResolvedValueOnce(true); // Index exists after creation

      const id = "test-id";
      const embedding = Array(768).fill(0.1);
      const metadata = { key: "value" };

      await service.upsert("bot-1", id, embedding, metadata);

      expect(mockClient.indices.create).toHaveBeenCalledTimes(1);
      expect(mockClient.index).toHaveBeenCalledTimes(1);
    });
  });

  describe("search", () => {
    it("reports legacy documents instead of silently returning no results", async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.count.mockResolvedValueOnce({ count: 2 });
      await expect(
        service.search("bot-1", Array(768).fill(0.1))
      ).rejects.toMatchObject({ payload: { status: 409 } });
      expect(mockClient.search).not.toHaveBeenCalled();
      expect(mockClient.count).toHaveBeenCalledWith({
        index: "test_criaembed",
        query: {
          bool: { must_not: [{ exists: { field: "metadata.botNamespace" } }] }
        }
      });
    });

    it("resumes scoped searches after legacy copies are removed", async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.count
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });
      mockClient.search.mockResolvedValue({ hits: { hits: [] } });
      await expect(
        service.search("bot-1", Array(768).fill(0.1))
      ).rejects.toMatchObject({
        payload: { status: 409 }
      });
      await expect(
        service.search("bot-1", Array(768).fill(0.1))
      ).resolves.toEqual([]);
      expect(mockClient.search).toHaveBeenCalledTimes(1);
    });

    it("should call search on the client with correct parameters", async () => {
      mockClient.indices.exists.mockResolvedValue(true); // Assume index exists for search
      const queryEmbedding = Array(768).fill(0.1);
      const k = 5;
      const mockHits = [{ _id: "doc1", _source: { metadata: {} } }];
      mockClient.search.mockResolvedValueOnce({
        hits: { hits: mockHits }
      } as any);

      const result = await service.search("bot-1", queryEmbedding, k);

      expect(mockClient.search).toHaveBeenCalledTimes(1);
      expect(mockClient.search).toHaveBeenCalledWith({
        index: (service as any).index,
        size: k,
        query: {
          script_score: {
            query: {
              bool: {
                filter: [{ term: { "metadata.botNamespace": "bot-1" } }]
              }
            },
            script: {
              source: `cosineSimilarity(params.query_vector, 'embedding') + 1.0`,
              params: { query_vector: queryEmbedding }
            }
          }
        }
      });

      expect(result).toEqual(mockHits);
    });

    it("does not allow caller metadata to override bot ownership", async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      await service.upsert("bot-1", "doc", Array(768).fill(0.1), {
        botNamespace: "bot-2"
      });
      expect(mockClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            metadata: { botNamespace: "bot-1" }
          })
        })
      );
    });

    it.each([0, -1, 1.5, 51])(
      "rejects invalid k=%s before touching Elasticsearch",
      async k => {
        await expect(
          service.search("bot-1", Array(768).fill(0.1), k)
        ).rejects.toMatchObject({ payload: { status: 400 } });
        expect(mockClient.indices.exists).not.toHaveBeenCalled();
      }
    );

    it("accepts k=50 and filters every search by bot ownership", async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.search.mockResolvedValue({ hits: { hits: [] } });
      await service.search("bot-2", Array(768).fill(0.1), 50);
      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 50,
          query: expect.objectContaining({
            script_score: expect.objectContaining({
              query: {
                bool: {
                  filter: [{ term: { "metadata.botNamespace": "bot-2" } }]
                }
              }
            })
          })
        })
      );
    });

    it("enforces metadata limits in UTF-8 bytes", async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      await service.upsert("bot-1", "at-limit", Array(768).fill(0.1), {
        value: "a".repeat(16372)
      });
      await expect(
        service.upsert("bot-1", "too-large", Array(768).fill(0.1), {
          value: "\u00e9".repeat(8190)
        })
      ).rejects.toMatchObject({ payload: { status: 400 } });
      expect(mockClient.index).toHaveBeenCalledTimes(1);
    });
    it("should create index if it does not exist before searching", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(false); // Index does not exist initially
      mockClient.indices.exists.mockResolvedValueOnce(true); // Index exists after creation

      const queryEmbedding = Array(768).fill(0.1);
      const k = 5;
      mockClient.search.mockResolvedValueOnce({ hits: { hits: [] } } as any);

      await service.search("bot-1", queryEmbedding, k);

      expect(mockClient.indices.create).toHaveBeenCalledTimes(1);
      expect(mockClient.search).toHaveBeenCalledTimes(1);
    });

    it("should return an empty array if no hits are found", async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.search.mockResolvedValueOnce({ hits: { hits: [] } } as any);

      const result = await service.search("bot-1", Array(768).fill(0.1));

      expect(result).toEqual([]);
    });

    it("should return an empty array if hits is undefined", async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.search.mockResolvedValueOnce({} as any);

      const result = await service.search("bot-1", Array(768).fill(0.1));

      expect(result).toEqual([]);
    });
  });
});
