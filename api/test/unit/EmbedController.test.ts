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

describe("EmbedController", () => {
  let service: {
    retrieveEmbed: jest.Mock;
    saveTrackingInfo: jest.Mock;
  };
  let controller: EmbedController;
  let request: any;

  beforeEach(() => {
    service = {
      retrieveEmbed: jest.fn(),
      saveTrackingInfo: jest.fn()
    };

    controller = new EmbedController(service as any);
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
});
