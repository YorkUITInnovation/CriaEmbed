/// <reference types="jest" />

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest
} from "@jest/globals";

jest.mock("../../src/config", () => ({
  Config: {
    CRIA_BOT_SERVER_URL: process.env.CRIA_BOT_SERVER_URL,
    CRIA_BOT_SERVER_TOKEN: process.env.CRIA_BOT_SERVER_TOKEN,
    CRIA_SERVER_URL: process.env.CRIA_SERVER_URL,
    CRIA_SERVER_TOKEN: process.env.CRIA_SERVER_TOKEN,
    WEB_APP_URL: process.env.WEB_APP_URL,
    THIS_APP_URL: process.env.THIS_APP_URL,
    ASSETS_FOLDER_PATH: process.env.ASSETS_FOLDER_PATH,
    DEFAULT_BOT_GREETING: process.env.DEFAULT_BOT_GREETING,
    ELASTICSEARCH_HOST: process.env.ELASTICSEARCH_HOST,
    ELASTICSEARCH_PORT: process.env.ELASTICSEARCH_PORT,
    ELASTICSEARCH_INDEX: process.env.ELASTICSEARCH_INDEX,
    RAGFLOW_EMBED_DIM: process.env.RAGFLOW_EMBED_DIM,
    DEBUG_ENABLED: process.env.DEBUG_ENABLED,
    MYSQL_PASSWORD: process.env.MYSQL_PASSWORD,
    MYSQL_PORT: process.env.MYSQL_PORT,
    MYSQL_HOST: process.env.MYSQL_HOST,
    MYSQL_USERNAME: process.env.MYSQL_USERNAME,
    MYSQL_DATABASE: process.env.MYSQL_DATABASE,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_USERNAME: process.env.REDIS_USERNAME,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    RATE_LIMIT_EMBED_MINUTE_MAX: process.env.RATE_LIMIT_EMBED_MINUTE_MAX,
    RATE_LIMIT_EMBED_HOUR_MAX: process.env.RATE_LIMIT_EMBED_HOUR_MAX,
    RATE_LIMIT_EMBED_DAY_MAX: process.env.RATE_LIMIT_EMBED_DAY_MAX,
    RATE_LIMIT_CHAT_MINUTE_MAX: process.env.RATE_LIMIT_CHAT_MINUTE_MAX,
    RATE_LIMIT_CHAT_HOUR_MAX: process.env.RATE_LIMIT_CHAT_HOUR_MAX,
    RATE_LIMIT_CHAT_DAY_MAX: process.env.RATE_LIMIT_CHAT_DAY_MAX,
    APP_MODE: process.env.APP_MODE,
    ELASTICSEARCH_USERNAME: process.env.ELASTICSEARCH_USERNAME,
    ELASTICSEARCH_PASSWORD: process.env.ELASTICSEARCH_PASSWORD,
    RAGFLOW_INDEX_NAME: process.env.RAGFLOW_INDEX_NAME
  },
  debugEnabled: jest.fn(() => false)
}));

import axios from "axios";
import {
  BotEmbed,
  IBotEmbed,
  IBotEmbedConfig
} from "../../src/database/mysql/controllers/BotEmbed";
import { Config } from "../../src/config";
import {
  BotNotFoundError,
  DuplicateEmbedError,
  EmbedNotFoundError,
  ManageService,
  UnauthorizedError
} from "../../src/services/ManageService";

jest.mock("../../src/database/mysql/controllers/BotEmbed");
jest.mock("axios");

const MockedBotEmbed = BotEmbed as jest.MockedClass<typeof BotEmbed>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

type DbMock = {
  retrieveByName: any;
  retrieveCriabotNameById: any;
  retrieveByAppId: any;
  existsByName: any;
  insert: any;
  removeByName: any;
  update: any;
};

describe("ManageService", () => {
  let manageService: ManageService;
  let db: DbMock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    db = {
      retrieveByName: jest.fn(),
      retrieveCriabotNameById: jest.fn(),
      retrieveByAppId: jest.fn(),
      existsByName: jest.fn(),
      insert: jest.fn(),
      removeByName: jest.fn(),
      update: jest.fn()
    };

    MockedBotEmbed.mockImplementation(() => db as any);

    const mockPool = {
      getConnection: jest.fn((callback: any) =>
        callback(null, { release: jest.fn() })
      ),
      end: jest.fn()
    };

    manageService = new ManageService(mockPool as any, Config as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should be defined", () => {
    expect(manageService).toBeDefined();
  });

  describe("botExistsAndIsAuthorized", () => {
    it("returns true when bot exists and key is authorized", async () => {
      db.retrieveByName.mockResolvedValueOnce({ botName: "testBot" });
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: {} } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: { authorized: true }
        } as any);

      await expect(
        manageService.botExistsAndIsAuthorized("testBot", "testApiKey")
      ).resolves.toBe(true);

      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        1,
        `${Config.CRIA_BOT_SERVER_URL}/bots/testBot/manage/about`,
        expect.objectContaining({
          headers: { "x-api-key": Config.CRIA_BOT_SERVER_TOKEN }
        })
      );
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        2,
        `${Config.CRIA_SERVER_URL}/auth/testApiKey/check`,
        expect.objectContaining({
          headers: { "x-api-key": Config.CRIA_BOT_SERVER_TOKEN }
        })
      );
    });

    it("resolves a numeric bot id before checking Criabot", async () => {
      db.retrieveByName.mockResolvedValueOnce(undefined);
      db.retrieveCriabotNameById.mockResolvedValueOnce("resolved bot");
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: {} } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: { authorized: true }
        } as any);

      await expect(
        manageService.botExistsAndIsAuthorized("1321", "testApiKey")
      ).resolves.toBe(true);

      expect(db.retrieveCriabotNameById).toHaveBeenCalledWith(1321);
      expect(mockedAxios.get).toHaveBeenNthCalledWith(
        1,
        `${Config.CRIA_BOT_SERVER_URL}/bots/resolved%20bot/manage/about`,
        expect.any(Object)
      );
    });

    it("throws BotNotFoundError when Criabot returns 404", async () => {
      db.retrieveByName.mockResolvedValueOnce(undefined);
      mockedAxios.get.mockResolvedValueOnce({ status: 404, data: {} } as any);

      await expect(
        manageService.botExistsAndIsAuthorized("missing-bot", "testApiKey")
      ).rejects.toThrow(BotNotFoundError);
    });

    it("throws UnauthorizedError when auth check denies the key", async () => {
      db.retrieveByName.mockResolvedValueOnce({ botName: "testBot" });
      mockedAxios.get
        .mockResolvedValueOnce({ status: 200, data: {} } as any)
        .mockResolvedValueOnce({
          status: 200,
          data: { authorized: false }
        } as any);

      await expect(
        manageService.botExistsAndIsAuthorized("testBot", "testApiKey")
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("existsBot", () => {
    it("returns true when the embed config exists by name", async () => {
      db.retrieveByName
        .mockResolvedValueOnce({ botName: "testBot" })
        .mockResolvedValueOnce({ botName: "testBot" });

      await expect(manageService.existsBot("testBot")).resolves.toBe(true);
      expect(db.retrieveByName).toHaveBeenNthCalledWith(1, "testBot");
      expect(db.retrieveByName).toHaveBeenNthCalledWith(2, "testBot");
    });

    it("returns true when a numeric bot id resolves to a configured embed bot", async () => {
      db.retrieveByName
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ botName: "resolved-bot" });
      db.retrieveCriabotNameById.mockResolvedValueOnce("resolved-bot");

      await expect(manageService.existsBot("99")).resolves.toBe(true);
      expect(db.retrieveCriabotNameById).toHaveBeenCalledWith(99);
      expect(db.retrieveByName).toHaveBeenNthCalledWith(2, "resolved-bot");
    });
  });

  describe("retrieveBot", () => {
    const apiKey = "testApiKey";
    const mockBot: IBotEmbed = {
      id: 1,
      botName: "testBot",
      botTitle: "Test Bot",
      botGreeting: "Hello"
    };

    it("retrieves a configured bot with authorization", async () => {
      jest
        .spyOn(manageService, "botExistsAndIsAuthorized")
        .mockResolvedValueOnce(true);
      db.retrieveByName
        .mockResolvedValueOnce(mockBot)
        .mockResolvedValueOnce(mockBot);
      db.existsByName.mockResolvedValueOnce(true);

      await expect(
        manageService.retrieveBot("testBot", apiKey, false)
      ).resolves.toEqual(mockBot);
      expect(manageService.botExistsAndIsAuthorized).toHaveBeenCalledWith(
        "testBot",
        apiKey
      );
      expect(db.existsByName).toHaveBeenCalledWith("testBot");
    });

    it("retrieves a configured bot when auth is skipped", async () => {
      db.retrieveByName
        .mockResolvedValueOnce(mockBot)
        .mockResolvedValueOnce(mockBot);
      db.existsByName.mockResolvedValueOnce(true);

      await expect(
        manageService.retrieveBot("testBot", apiKey, true)
      ).resolves.toEqual(mockBot);
    });

    it("auto-provisions a missing embed config for an existing Criabot bot", async () => {
      jest
        .spyOn(manageService, "botExistsAndIsAuthorized")
        .mockResolvedValueOnce(true);
      db.retrieveByName
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce({ botName: "fresh-bot", botGreeting: "Hi" });
      db.existsByName.mockResolvedValueOnce(false);
      db.insert.mockResolvedValueOnce({ botName: "fresh-bot" });
      mockedAxios.get.mockResolvedValueOnce({ status: 200, data: {} } as any);

      await expect(
        manageService.retrieveBot("fresh-bot", apiKey, false)
      ).resolves.toMatchObject({ botName: "fresh-bot" });
      expect(db.insert).toHaveBeenCalledWith({ botName: "fresh-bot" });
    });

    it("throws EmbedNotFoundError when the bot still cannot be loaded", async () => {
      jest
        .spyOn(manageService, "botExistsAndIsAuthorized")
        .mockResolvedValueOnce(true);
      db.retrieveByName
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(undefined);
      db.existsByName.mockResolvedValueOnce(false);
      mockedAxios.get.mockResolvedValueOnce({ status: 404, data: {} } as any);

      await expect(
        manageService.retrieveBot("missing-bot", apiKey, false)
      ).rejects.toThrow(EmbedNotFoundError);
    });
  });

  describe("retrieveBotByMicrosoftAppId", () => {
    it("retrieves a bot by Microsoft app id", async () => {
      const mockBot: IBotEmbed = {
        id: 1,
        botName: "testBot",
        botTitle: "Test Bot"
      };
      db.retrieveByAppId.mockResolvedValueOnce(mockBot);

      await expect(
        manageService.retrieveBotByMicrosoftAppId("app-id")
      ).resolves.toEqual(mockBot);
    });

    it("throws EmbedNotFoundError when the app id does not match a bot", async () => {
      db.retrieveByAppId.mockResolvedValueOnce(undefined);

      await expect(
        manageService.retrieveBotByMicrosoftAppId("missing-app")
      ).rejects.toThrow(EmbedNotFoundError);
    });
  });

  describe("insertBot", () => {
    it("inserts a new bot config", async () => {
      const config: IBotEmbedConfig = {
        botName: "newBot",
        botTitle: "New Bot"
      };
      const insertedBot: IBotEmbed = { id: 2, ...config };
      jest
        .spyOn(manageService, "botExistsAndIsAuthorized")
        .mockResolvedValueOnce(true);
      db.existsByName.mockResolvedValueOnce(false);
      db.insert.mockResolvedValueOnce(insertedBot);

      await expect(
        manageService.insertBot(config, "testApiKey")
      ).resolves.toEqual(insertedBot);
      expect(db.insert).toHaveBeenCalledWith(config);
    });

    it("throws DuplicateEmbedError when the config already exists", async () => {
      jest
        .spyOn(manageService, "botExistsAndIsAuthorized")
        .mockResolvedValueOnce(true);
      db.existsByName.mockResolvedValueOnce(true);

      await expect(
        manageService.insertBot({ botName: "dupBot" }, "testApiKey")
      ).rejects.toThrow(DuplicateEmbedError);
    });
  });

  describe("deleteBot", () => {
    it("deletes an existing config", async () => {
      jest
        .spyOn(manageService, "botExistsAndIsAuthorized")
        .mockResolvedValueOnce(true);
      db.existsByName.mockResolvedValueOnce(true);
      db.removeByName.mockResolvedValueOnce(1);

      await expect(
        manageService.deleteBot("delete-me", "testApiKey")
      ).resolves.toBe(1);
    });

    it("throws EmbedNotFoundError when deleting a missing config", async () => {
      jest
        .spyOn(manageService, "botExistsAndIsAuthorized")
        .mockResolvedValueOnce(true);
      db.existsByName.mockResolvedValueOnce(false);

      await expect(
        manageService.deleteBot("missing", "testApiKey")
      ).rejects.toThrow(EmbedNotFoundError);
    });
  });

  describe("updateBot", () => {
    it("updates an existing config", async () => {
      const config: IBotEmbedConfig = {
        botName: "updatedBot",
        botTitle: "Updated Bot"
      };
      const updatedBot: IBotEmbed = { id: 3, ...config };
      jest
        .spyOn(manageService, "botExistsAndIsAuthorized")
        .mockResolvedValueOnce(true);
      db.update.mockResolvedValueOnce(updatedBot);

      await expect(
        manageService.updateBot(config, "testApiKey")
      ).resolves.toEqual(updatedBot);
    });

    it("throws EmbedNotFoundError when update returns no config", async () => {
      jest
        .spyOn(manageService, "botExistsAndIsAuthorized")
        .mockResolvedValueOnce(true);
      db.update.mockResolvedValueOnce(undefined);

      await expect(
        manageService.updateBot({ botName: "missing" }, "testApiKey")
      ).rejects.toThrow(EmbedNotFoundError);
    });
  });
});
