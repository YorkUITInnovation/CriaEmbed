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

describe("EmbedPopupHTMLController — $-substitution injection", () => {
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

  // htmlAttrEscape covers & < > " ' but not `$`, and the escaped value used to be
  // passed as a *string* replacement to replaceAll, where `$&`, "$`", `$'` and `$n`
  // are substitution patterns. "$`" therefore spliced the text preceding the match
  // -- raw markup -- into the attribute value.
  it.each(["$`", "$'", "$&", "$1", "$$"])(
    "does not splice raw template markup for botId %j",
    async botId => {
      await controller.getPopupEmbedHtml(botId, request);

      // The wrapper div is the first thing in the template; if a substitution
      // pattern expanded, a second raw copy of it lands inside an attribute.
      const wrapperCount = (sent.match(/<div class="cria-wrapper"/g) || [])
        .length;
      expect(wrapperCount).toBe(1);
      expect(sent).not.toContain('botId="<div');
    }
  );

  it("reflects a $-containing botId literally", async () => {
    await controller.getPopupEmbedHtml("$`", request);
    expect(sent).toContain('botId="$`"');
  });

  it("still reflects an ordinary botId unchanged", async () => {
    await controller.getPopupEmbedHtml(
      "Moodle 5 laptop dev-The art of Art",
      request
    );
    // Real bot names contain spaces, so the fix must not narrow the accepted set.
    expect(sent).toContain('botId="Moodle 5 laptop dev-The art of Art"');
  });
});
