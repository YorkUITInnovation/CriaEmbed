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
    Example: decorator,
    Get: decorator,
    Middlewares: decorator,
    Path: decorator,
    Produces: decorator,
    Query: decorator,
    Request: decorator,
    Route: decorator,
    Tags: decorator
  };
});

import { EmbedPopupJSController } from "../../src/controllers/embed/popup/EmbedPopupJSController";
import { EmbedInlineJSController } from "../../src/controllers/embed/popup/EmbedInlineJSController";

describe("popup/inline JS controllers", () => {
  const request = () => {
    let sent = "";
    return {
      req: {
        res: {
          setHeader: jest.fn(),
          send: jest.fn((body: string) => {
            sent = body;
          })
        }
      },
      read: () => sent
    };
  };

  it("does not rewrite attacker '$botId' text in popup script payload", async () => {
    const controller = new EmbedPopupJSController({} as any);
    const io = request();
    await controller.getPopupEmbedJs('abc$botId"-x-"', false, io.req as any);
    expect(io.read()).toContain('const botId = "abc$botId\\"-x-\\""');
  });

  it("does not rewrite attacker '$botId' text in inline script payload", async () => {
    const controller = new EmbedInlineJSController({} as any);
    const io = request();
    await controller.getInlineEmbed('abc$botId"-x-"', io.req as any);
    expect(io.read()).toContain('const botId = "abc$botId\\"-x-\\""');
  });
});
