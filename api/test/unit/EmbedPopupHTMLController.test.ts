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
    Request: decorator,
    Route: decorator,
    Tags: decorator
  };
});

import { EmbedPopupHTMLController } from "../../src/controllers/embed/popup/EmbedPopupHTMLController";

describe("EmbedPopupHTMLController — botId reflection is XSS-safe", () => {
  let controller: EmbedPopupHTMLController;
  let request: any;
  let sent: string;

  beforeEach(() => {
    controller = new EmbedPopupHTMLController({} as any);
    sent = "";
    request = {
      res: {
        setHeader: jest.fn(),
        send: jest.fn((body: string) => {
          sent = body;
        })
      }
    };
  });

  it("HTML-encodes an attribute-breakout botId", async () => {
    await controller.getPopupEmbedHtml('"><script>alert(1)</script>', request);

    // Raw tag / attribute-breakout must not survive; only the encoded form may.
    expect(sent).not.toContain("<script>");
    expect(sent).not.toContain("</script>");
    expect(sent).not.toContain('"><script');
    expect(sent).toContain("&lt;script&gt;");
  });

  it("keeps a quote/bracket botId inside the onclick JS string", async () => {
    await controller.getPopupEmbedHtml("'];alert(1)//", request);

    // The raw breakout sequence must not survive into the onclick handler.
    expect(sent).not.toContain("'];alert(1)");
    // The key is emitted as an HTML-encoded, JSON-quoted string.
    expect(sent).toContain("window.CRIA[&quot;");
  });

  it("passes an ordinary botId through unchanged (backward compatible)", async () => {
    await controller.getPopupEmbedHtml("my-bot_1", request);

    expect(sent).toContain('botId="my-bot_1"');
    expect(sent).toContain("window.CRIA[&quot;my-bot_1&quot;].switch()");
  });
});
