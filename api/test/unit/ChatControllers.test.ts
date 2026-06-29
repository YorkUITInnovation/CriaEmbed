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
    Get: decorator,
    Middlewares: decorator,
    Path: decorator,
    Post: decorator,
    Route: decorator,
    Tags: decorator
  };
});

import { ChatExistsController } from "../../src/controllers/chats/ChatExistsController";
import { ChatsCreateController } from "../../src/controllers/chats/ChatsCreateController";

describe("Chat controllers", () => {
  it("returns a success payload with status 200 when creating a chat", async () => {
    const service = {
      createChat: jest.fn().mockResolvedValue("new-chat-id"),
      transferTrackingInfo: jest.fn().mockResolvedValue(undefined)
    };
    const controller = new ChatsCreateController(service as any);

    const result = await controller.create("old-chat-id");

    expect(result).toMatchObject({
      status: 200,
      code: "SUCCESS",
      chatId: "new-chat-id"
    });
    expect(service.transferTrackingInfo).toHaveBeenCalledWith(
      "old-chat-id",
      "new-chat-id"
    );
  });

  it("returns a success payload with status 200 when checking chat existence", async () => {
    const service = {
      existsEmbedChat: jest.fn().mockResolvedValue(true)
    };
    const controller = new ChatExistsController(service as any);

    const result = await controller.exists("chat-1");

    expect(result).toMatchObject({
      status: 200,
      code: "SUCCESS",
      exists: true
    });
  });
});
