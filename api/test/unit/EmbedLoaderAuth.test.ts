import axios from "axios";
import { EmbedController } from "../../src/controllers/embed/EmbedController";
import { BotEmbed } from "../../src/database/mysql/controllers/BotEmbed";
import { EmbedService } from "../../src/services/EmbedService";
import { ManageService } from "../../src/services/ManageService";
import { Config } from "../../src/config";

jest.mock("axios");
jest.mock("tsoa", () => {
  const decorator = () => () => undefined;
  return {
    Controller: class {
      public setStatus(): void {}
      public setHeader(): void {}
    },
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
jest.mock("../../src/database/mysql/controllers/BotEmbed");
jest.mock("../../src/services/VectorStoreService");
jest.mock("ioredis", () =>
  jest.fn().mockImplementation(() => ({ on: jest.fn(), disconnect: jest.fn() }))
);

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedBotEmbed = BotEmbed as jest.MockedClass<typeof BotEmbed>;

describe("POST loader authorization through real tracking and manage services", () => {
  let controller: EmbedController;
  let trackingCache: { set: jest.Mock };
  let request: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const config = { botName: "suite-bot", personalizationPayload: [] };
    mockedBotEmbed.mockImplementation(
      () =>
        ({
          retrieveByName: jest.fn().mockResolvedValue(config),
          existsByName: jest.fn().mockResolvedValue(true)
        } as any)
    );
    const manage = new ManageService({} as any);
    trackingCache = { set: jest.fn().mockResolvedValue("OK") };
    const service = new EmbedService(
      manage,
      {} as any,
      trackingCache as any,
      {} as any
    );
    jest
      .spyOn(service, "retrieveEmbed")
      .mockResolvedValue(["window.CRIA = {}", "chat-current"]);
    controller = new EmbedController(service, manage);
    request = { res: { setHeader: jest.fn(), send: jest.fn() } };

    mockedAxios.get.mockImplementation(async (url, options) => {
      if (url === `${Config.CRIA_BOT_SERVER_URL}/bots/suite-bot/manage/about`) {
        return {
          status:
            options?.headers?.["x-api-key"] === "current-bot-key" ? 200 : 401,
          data: {}
        } as any;
      }
      if (url === `${Config.CRIA_SERVER_URL}/auth/current-bot-key/check`) {
        return {
          status: 200,
          data: { authorized: true, master: false }
        } as any;
      }
      throw new Error(`Unexpected HTTP request: ${url}`);
    });
  });

  it.each([{}, { courseId: 1, courseName: "Cost gate" }])(
    "loads with the current bot key and persists session %p",
    async session => {
      await expect(
        controller.postLoadEmbed(
          request,
          "suite-bot",
          "current-bot-key",
          session
        )
      ).resolves.toBe("");

      expect(trackingCache.set).toHaveBeenCalledWith("chat-current", {
        ...session,
        botName: "suite-bot",
        embedChatReady: true
      });
      expect(request.res.setHeader).toHaveBeenCalledWith(
        "X-Chat-Id",
        "chat-current"
      );
      expect(request.res.send).toHaveBeenCalledWith("window.CRIA = {}");
    }
  );

  it.each(["deleted-generation-key", "another-bot-key"])(
    "still returns 403 for %s without writing tracking or serving a loader",
    async key => {
      await expect(
        controller.postLoadEmbed(request, "suite-bot", key, {})
      ).resolves.toMatchObject({ status: 403, code: "UNAUTHORIZED" });

      expect(trackingCache.set).not.toHaveBeenCalled();
      expect(request.res.send).not.toHaveBeenCalled();
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    }
  );

  it("still rejects a key denied by the global authorization check", async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ status: 200, data: {} })
      .mockResolvedValueOnce({ status: 200, data: { authorized: false } });

    await expect(
      controller.postLoadEmbed(request, "suite-bot", "revoked-key", {})
    ).resolves.toMatchObject({ status: 403, code: "UNAUTHORIZED" });
    expect(trackingCache.set).not.toHaveBeenCalled();
    expect(request.res.send).not.toHaveBeenCalled();
  });
});
