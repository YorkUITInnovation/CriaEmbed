jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    quit: jest.fn(),
    disconnect: jest.fn()
  }));
});

jest.mock("tsoa", () => {
  const decorator = () => () => undefined;
  class MockController {
    public setStatus(): void {}
    public setHeader(): void {}
  }
  return {
    Controller: MockController,
    Body: decorator,
    Example: decorator,
    Get: decorator,
    Header: decorator,
    Middlewares: decorator,
    Path: decorator,
    Post: decorator,
    Produces: decorator,
    Query: decorator,
    Request: decorator,
    Route: decorator,
    Tags: decorator
  };
});

import { EmbedController } from "../../src/controllers/embed/EmbedController";
import { UnauthorizedError } from "../../src/services/ManageService";

describe("EmbedController", () => {
  let service: {
    retrieveEmbed: jest.Mock;
    saveTrackingInfo: jest.Mock;
    upsertEmbedding: jest.Mock;
    searchEmbeddings: jest.Mock;
  };
  let manageService: {
    isApiKeyAuthorized: jest.Mock;
  };
  let controller: EmbedController;
  let request: any;

  beforeEach(() => {
    service = {
      retrieveEmbed: jest.fn(),
      saveTrackingInfo: jest.fn(),
      upsertEmbedding: jest.fn(),
      searchEmbeddings: jest.fn()
    };
    manageService = {
      isApiKeyAuthorized: jest.fn().mockResolvedValue(true)
    };

    controller = new EmbedController(service as any, manageService as any);
    request = {
      res: {
        setHeader: jest.fn(),
        send: jest.fn()
      }
    };
  });

  it("returns 401 when session data is posted without an API key", async () => {
    const result = await controller.postLoadEmbed(
      request,
      "bot-id",
      undefined as any,
      { foo: "bar" },
      false,
      false
    );

    expect(result).toMatchObject({
      status: 401,
      code: "UNAUTHORIZED"
    });
    expect(service.retrieveEmbed).not.toHaveBeenCalled();
  });

  it("sends javascript loader content and chat id headers on success", async () => {
    service.retrieveEmbed.mockResolvedValueOnce([
      'console.log("loader")',
      "chat-123"
    ]);

    const result = await controller.getLoadEmbed(request, "1321", false, false);

    expect(result).toBe("");
    expect(service.retrieveEmbed).toHaveBeenCalledWith("1321", false, false);
    expect(request.res.setHeader).toHaveBeenCalledWith("X-Chat-Id", "chat-123");
    expect(request.res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/javascript; charset=utf-8"
    );
    expect(request.res.send).toHaveBeenCalledWith('console.log("loader")');
  });

  it("persists tracking info when session data and API key are supplied", async () => {
    service.retrieveEmbed.mockResolvedValueOnce([
      'console.log("loader")',
      "chat-456"
    ]);

    await controller.postLoadEmbed(
      request,
      "1321",
      "api-key",
      { courseId: 42 },
      false,
      false
    );

    expect(service.saveTrackingInfo).toHaveBeenCalledWith(
      "1321",
      "chat-456",
      { courseId: 42 },
      "api-key"
    );
  });

  it("still loads the embed when the tracking write fails (best-effort)", async () => {
    service.retrieveEmbed.mockResolvedValueOnce([
      'console.log("loader")',
      "chat-789"
    ]);
    service.saveTrackingInfo.mockRejectedValueOnce(new Error("redis down"));

    const result = await controller.postLoadEmbed(
      request,
      "1321",
      "api-key",
      { courseId: 1 },
      false,
      false
    );

    expect(result).toBe("");
    expect(request.res.send).toHaveBeenCalledWith('console.log("loader")');
  });

  it("surfaces an auth failure from the tracking write instead of swallowing it", async () => {
    service.retrieveEmbed.mockResolvedValueOnce([
      'console.log("loader")',
      "chat-000"
    ]);
    service.saveTrackingInfo.mockRejectedValueOnce(new UnauthorizedError());

    const result = await controller.postLoadEmbed(
      request,
      "1321",
      "bad-key",
      { courseId: 1 },
      false,
      false
    );

    expect(result).toMatchObject({ status: 403, code: "UNAUTHORIZED" });
    expect(request.res.send).not.toHaveBeenCalled();
  });

  it("rejects upsertEmbedding without a valid API key", async () => {
    manageService.isApiKeyAuthorized.mockResolvedValue(false);

    const result = await controller.upsertEmbedding(undefined as any, {
      id: "doc-1",
      embedding: [0.1, 0.2],
      metadata: {}
    });

    expect(result).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(service.upsertEmbedding).not.toHaveBeenCalled();
  });

  it("performs upsertEmbedding when the API key is authorized", async () => {
    const result = await controller.upsertEmbedding("api-key", {
      id: "doc-1",
      embedding: [0.1, 0.2],
      metadata: { source: "test" }
    });

    expect(manageService.isApiKeyAuthorized).toHaveBeenCalledWith("api-key");
    expect(service.upsertEmbedding).toHaveBeenCalledWith("doc-1", [0.1, 0.2], {
      source: "test"
    });
    expect(result).toMatchObject({ status: 200, code: "SUCCESS" });
  });

  it("rejects searchEmbeddings without a valid API key", async () => {
    manageService.isApiKeyAuthorized.mockResolvedValue(false);

    const result = await controller.searchEmbeddings(undefined as any, {
      queryEmbedding: [0.1, 0.2]
    });

    expect(result).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(service.searchEmbeddings).not.toHaveBeenCalled();
  });

  it("performs searchEmbeddings when the API key is authorized", async () => {
    service.searchEmbeddings.mockResolvedValueOnce([
      { id: "doc-1", score: 0.9 }
    ]);

    const result = await controller.searchEmbeddings("api-key", {
      queryEmbedding: [0.1, 0.2],
      k: 5
    });

    expect(service.searchEmbeddings).toHaveBeenCalledWith([0.1, 0.2], 5);
    expect(result).toEqual({ results: [{ id: "doc-1", score: 0.9 }] });
  });

  it("treats an authorization-check failure as unauthorized", async () => {
    manageService.isApiKeyAuthorized.mockRejectedValue(
      new Error("network down")
    );

    const result = await controller.upsertEmbedding("api-key", {
      id: "doc-1",
      embedding: [0.1],
      metadata: {}
    });

    expect(result).toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(service.upsertEmbedding).not.toHaveBeenCalled();
  });
});
