import { jest } from "@jest/globals";
import { VectorStoreService } from "../../src/services/VectorStoreService";
import { CriaError } from "../../src/models/CriaResponse";

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

describe("VectorStoreService - Negative Cases", () => {
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

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VectorStoreService();
    mockClient = (service as any).client;
    mockClient.indices.exists = jest.fn();
    mockClient.indices.create = jest.fn();
    mockClient.indices.putMapping = jest.fn();
    mockClient.index = jest.fn();
    mockClient.search = jest.fn();
    mockClient.count = jest.fn().mockResolvedValue({ count: 0 });
  });

  describe("createIndex - Error Handling", () => {
    it("propagates mapping failures and retries initialization on the next request", async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.indices.putMapping.mockRejectedValueOnce(
        new Error("Mapping rejected")
      );
      mockClient.search.mockResolvedValue({ hits: { hits: [] } });
      await expect(
        service.search("bot-1", Array(768).fill(0.1))
      ).rejects.toThrow("Mapping rejected");
      await expect(
        service.search("bot-1", Array(768).fill(0.1))
      ).resolves.toEqual([]);
      expect(mockClient.indices.putMapping).toHaveBeenCalledTimes(2);
    });

    it("should handle Elasticsearch connection errors", async () => {
      mockClient.indices.exists.mockRejectedValueOnce(
        new Error("Connection refused")
      );

      await expect(service.createIndex()).rejects.toThrow("Connection refused");
    });

    it("should handle index creation failures", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(false);
      mockClient.indices.create.mockRejectedValueOnce(
        new Error("Index creation failed")
      );

      await expect(service.createIndex()).rejects.toThrow(
        "Index creation failed"
      );
    });

    it("should handle permission errors", async () => {
      const error = new Error("Forbidden");
      (error as any).statusCode = 403;
      mockClient.indices.exists.mockRejectedValueOnce(error);

      await expect(service.createIndex()).rejects.toThrow("Forbidden");
    });
  });

  describe("upsert - Error Handling", () => {
    it("should handle Elasticsearch index errors", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      mockClient.index.mockRejectedValueOnce(new Error("Index error"));

      await expect(
        service.upsert("bot-1", "doc-id", Array(768).fill(0.1), {
          source: "test"
        })
      ).rejects.toThrow("Index error");
    });

    it("should handle invalid embedding dimensions", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      await expect(
        service.upsert("bot-1", "doc-id", [], { source: "test" })
      ).rejects.toBeInstanceOf(CriaError);
    });

    it("should handle document ID conflicts", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      const error = new Error("Document already exists");
      (error as any).statusCode = 409;
      mockClient.index.mockRejectedValueOnce(error);

      await expect(
        service.upsert("bot-1", "existing-doc-id", Array(768).fill(0.1), {
          source: "test"
        })
      ).rejects.toThrow("Document already exists");
    });
  });

  describe("search - Error Handling", () => {
    it("propagates legacy inventory failures without searching", async () => {
      mockClient.indices.exists.mockResolvedValue(true);
      mockClient.count.mockRejectedValueOnce(new Error("Count unavailable"));
      await expect(
        service.search("bot-1", Array(768).fill(0.1))
      ).rejects.toThrow("Count unavailable");
      expect(mockClient.search).not.toHaveBeenCalled();
    });
    it("should handle Elasticsearch search errors", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      mockClient.search.mockRejectedValueOnce(new Error("Search query failed"));

      await expect(
        service.search("bot-1", Array(768).fill(0.1), 5)
      ).rejects.toThrow("Search query failed");
    });

    it("should handle invalid query embedding", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      await expect(service.search("bot-1", [], 5)).rejects.toBeInstanceOf(
        CriaError
      );
    });

    it("should handle malformed search response", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      mockClient.search.mockResolvedValueOnce({ hits: null } as any);

      const result = await service.search("bot-1", Array(768).fill(0.1), 5);
      expect(result).toEqual([]);
    });

    it("should handle search timeout", async () => {
      mockClient.indices.exists.mockResolvedValueOnce(true);
      const timeoutError = new Error("Request timeout");
      (timeoutError as any).statusCode = 408;
      mockClient.search.mockRejectedValueOnce(timeoutError);

      await expect(
        service.search("bot-1", Array(768).fill(0.1), 5)
      ).rejects.toThrow("Request timeout");
    });
  });

  describe("indexExists - Error Handling", () => {
    it("should handle connection errors when checking index", async () => {
      mockClient.indices.exists.mockRejectedValueOnce(
        new Error("Connection error")
      );

      await expect(service.indexExists()).rejects.toThrow("Connection error");
    });

    it("should handle authentication errors", async () => {
      const error = new Error("Unauthorized");
      (error as any).statusCode = 401;
      mockClient.indices.exists.mockRejectedValueOnce(error);

      await expect(service.indexExists()).rejects.toThrow("Unauthorized");
    });
  });
});
