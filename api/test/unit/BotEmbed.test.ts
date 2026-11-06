import {
  BotEmbed,
  IBotEmbedConfig,
  IBotEmbed
} from "../../src/database/mysql/controllers/BotEmbed";

describe("BotEmbed (DB controller) - Insert/Update value handling", () => {
  it("should convert undefined boolean fields to NULL and not insert NaN (insert)", async () => {
    const captured: { sqls: string[]; valuesList: any[][] } = {
      sqls: [],
      valuesList: []
    };

    const mockPool: any = {
      query: jest.fn((...args: any[]) => {
        // normalize arguments: (sql, values?, cb)
        const sql: string = args[0];
        let values: any[] = [];
        let cb: any = args[args.length - 1];
        if (args.length === 2 && typeof args[1] === "function") {
          values = [];
          cb = args[1];
        } else if (args.length >= 3) {
          values = args[1];
        }

        captured.sqls.push(sql);
        captured.valuesList.push(values);

        if (sql.includes("INSERT INTO `EmbedBot`")) {
          // simulate insert result
          cb(null, { insertId: 42 });
        } else if (sql.includes("SELECT * FROM `EmbedBot` WHERE `id`=?")) {
          // returned row should match expectations (nulls for optional fields)
          cb(null, [
            {
              id: 42,
              botName: "test-bot-1",
              botTitle: null,
              botSubTitle: null,
              botGreeting: null,
              botIconUrl: null,
              botEmbedTheme: null,
              botWatermark: null,
              botLocale: null,
              initialPrompts: null,
              microsoftAppId: null,
              microsoftAppPassword: null,
              integrationsNoContextReply: null,
              integrationsFirstEmailOnly: null,
              integrationsWhitelistFilter: null,
              botEmbedDefaultEnabled: null,
              botTrustWarning: null,
              embedHoverTooltip: null,
              botContact: null
            }
          ]);
        } else {
          cb(null, []);
        }
      })
    };

    const controller = new BotEmbed(mockPool);

    const cfg: IBotEmbedConfig = {
      botName: "test-bot-1"
      // intentionally omit optional boolean fields and initialPrompts
    } as IBotEmbedConfig;

    const inserted = await controller.insert(cfg);

    // Ensure the insert query was executed
    expect(captured.sqls.length).toBeGreaterThan(0);
    const insertIdx = captured.sqls.findIndex(s =>
      s.includes("INSERT INTO `EmbedBot`")
    );
    const insertValues =
      insertIdx >= 0 ? captured.valuesList[insertIdx] : captured.valuesList[0];

    // Check that booleans were mapped to null (no NaN)
    // According to BotEmbed.insert ordering: botWatermark is at index 6
    expect(insertValues[6]).toBeNull();

    // integrationsNoContextReply -> index 12 (shifted by +1 due to botEmbedPosition)
    expect(insertValues[12]).toBeNull();
    // integrationsFirstEmailOnly -> index 13 (shifted by +1 due to botEmbedPosition)
    expect(insertValues[13]).toBeNull();
    // botEmbedDefaultEnabled -> index 15 (shifted by +1 due to botEmbedPosition)
    expect(insertValues[15]).toBeNull();

    // initialPrompts should be null, not "undefined" / not a string
    expect(insertValues[8]).toBeNull();

    // Confirm returned object has nulls converted to nulls (post processing)
    expect(inserted.botName).toBe("test-bot-1");
    expect(inserted.botWatermark).toBeNull();
    expect(inserted.botEmbedDefaultEnabled).toBeNull();
  });

  it("should convert boolean true/false to 1/0 (insert)", async () => {
    const captured: { sqls: string[]; valuesList: any[][] } = {
      sqls: [],
      valuesList: []
    };

    const mockPool: any = {
      query: jest.fn((...args: any[]) => {
        const sql: string = args[0];
        let values: any[] = [];
        let cb: any = args[args.length - 1];
        if (args.length === 2 && typeof args[1] === "function") {
          values = [];
          cb = args[1];
        } else if (args.length >= 3) {
          values = args[1];
        }

        captured.sqls.push(sql);
        captured.valuesList.push(values);

        if (sql.includes("INSERT INTO `EmbedBot`")) {
          cb(null, { insertId: 99 });
        } else if (sql.includes("SELECT * FROM `EmbedBot` WHERE `id`=?")) {
          cb(null, [
            {
              id: 99,
              botName: "test-bool",
              botWatermark: 1,
              integrationsNoContextReply: 0,
              integrationsFirstEmailOnly: 1,
              botEmbedDefaultEnabled: 0,
              initialPrompts: JSON.stringify([])
            }
          ]);
        } else {
          cb(null, []);
        }
      })
    };

    const controller = new BotEmbed(mockPool);

    const cfg: IBotEmbedConfig = {
      botName: "test-bool",
      botWatermark: true,
      integrationsNoContextReply: false,
      integrationsFirstEmailOnly: true,
      botEmbedDefaultEnabled: false,
      initialPrompts: []
    } as IBotEmbedConfig;

    const inserted = await controller.insert(cfg);

    // booleans should be converted to 1/0
    const insertIdx = captured.sqls.findIndex(s =>
      s.includes("INSERT INTO `EmbedBot`")
    );
    const insertValues =
      insertIdx >= 0 ? captured.valuesList[insertIdx] : captured.valuesList[0];

    expect(insertValues[6]).toBe(1);
    expect(insertValues[12]).toBe(0); // integrationsNoContextReply (shifted by +1)
    expect(insertValues[13]).toBe(1); // integrationsFirstEmailOnly (shifted by +1)
    expect(insertValues[15]).toBe(0); // botEmbedDefaultEnabled (shifted by +1)

    // initialPrompts serialized
    expect(insertValues[8]).toBe(JSON.stringify([]));

    expect(inserted.botName).toBe("test-bool");
    expect(inserted.botWatermark).toBe(true);
  });

  it("should treat initialPrompts undefined as NULL on update and not send NaN", async () => {
    const captured: { sqls: string[]; valuesList: any[][] } = {
      sqls: [],
      valuesList: []
    };

    const mockPool: any = {
      query: jest.fn((...args: any[]) => {
        const sql: string = args[0];
        let values: any[] = [];
        let cb: any = args[args.length - 1];
        if (args.length === 2 && typeof args[1] === "function") {
          values = [];
          cb = args[1];
        } else if (args.length >= 3) {
          values = args[1];
        }

        captured.sqls.push(sql);
        captured.valuesList.push(values);

        if (sql.includes("UPDATE EmbedBot")) {
          cb(null, { affectedRows: 1 });
        } else if (sql.includes("SELECT * FROM `EmbedBot` WHERE `botName`=?")) {
          cb(null, [
            {
              id: 55,
              botName: "test-update",
              botWatermark: null,
              integrationsNoContextReply: null,
              integrationsFirstEmailOnly: null,
              botEmbedDefaultEnabled: null,
              initialPrompts: null
            }
          ]);
        } else {
          cb(null, []);
        }
      })
    };

    const controller = new BotEmbed(mockPool);

    const cfg: IBotEmbedConfig = {
      botName: "test-update"
      // nothing else - omitted fields
    } as IBotEmbedConfig;

    const res = await controller.update(cfg);

    // We recorded all SQL statements - ensure one of them was the UPDATE
    expect(captured.sqls.some(s => s.includes("UPDATE EmbedBot"))).toBe(true);

    // find the UPDATE call's values (it should be the one whose sql includes 'UPDATE EmbedBot')
    const updateIdx = captured.sqls.findIndex(s =>
      s.includes("UPDATE EmbedBot")
    );
    const updateValues = captured.valuesList[updateIdx];

    // Check positions of boolean conversions in update values: botWatermark at index 5
    expect(updateValues[5]).toBeNull();
    // initialPrompts index 7
    expect(updateValues[7]).toBeNull();

    expect(res?.botName).toBe("test-update");
    expect(res?.botWatermark).toBeNull();
  });

  it("should persist showSources/autoScrollTop as 1/0 on insert and update, defaulting to 1", async () => {
    const captured: { sqls: string[]; valuesList: any[][] } = {
      sqls: [],
      valuesList: []
    };

    const mockPool: any = {
      query: jest.fn((...args: any[]) => {
        const sql: string = args[0];
        let values: any[] = [];
        let cb: any = args[args.length - 1];
        if (args.length === 2 && typeof args[1] === "function") {
          values = [];
          cb = args[1];
        } else if (args.length >= 3) {
          values = args[1];
        }

        captured.sqls.push(sql);
        captured.valuesList.push(values);

        if (sql.includes("INSERT INTO `EmbedBot`")) {
          cb(null, { insertId: 7 });
        } else if (sql.includes("UPDATE EmbedBot")) {
          cb(null, { affectedRows: 1 });
        } else if (sql.includes("SELECT * FROM `EmbedBot` WHERE `id`=?")) {
          cb(null, [
            { id: 7, botName: "flags-bot", showSources: 0, autoScrollTop: 1 }
          ]);
        } else if (sql.includes("SELECT * FROM `EmbedBot` WHERE `botName`=?")) {
          cb(null, [
            { id: 7, botName: "flags-bot", showSources: 0, autoScrollTop: 1 }
          ]);
        } else {
          cb(null, []);
        }
      })
    };

    const controller = new BotEmbed(mockPool);

    // Insert with explicit false/true flags
    await controller.insert({
      botName: "flags-bot",
      showSources: false,
      autoScrollTop: true
    } as IBotEmbedConfig);
    const insertValues =
      captured.valuesList[
        captured.sqls.findIndex(s => s.includes("INSERT INTO"))
      ];
    expect(insertValues[22]).toBe(0); // showSources
    expect(insertValues[23]).toBe(1); // autoScrollTop

    // Update with flags omitted: NOT NULL columns must not receive NULL, default 1
    await controller.update({ botName: "flags-bot" } as IBotEmbedConfig);
    const updateValues =
      captured.valuesList[
        captured.sqls.findIndex(s => s.includes("UPDATE EmbedBot"))
      ];
    expect(updateValues[21]).toBe(1); // showSources
    expect(updateValues[22]).toBe(1); // autoScrollTop

    // Retrieved row coerces to booleans
    const row = await controller.retrieveByName("flags-bot");
    expect(row?.showSources).toBe(false);
    expect(row?.autoScrollTop).toBe(true);
  });

  it("should default showSources/autoScrollTop to true when the columns are absent from a row", async () => {
    const mockPool: any = {
      query: jest.fn((...args: any[]) => {
        const cb: any = args[args.length - 1];
        cb(null, [{ id: 8, botName: "legacy-bot" }]);
      })
    };

    const controller = new BotEmbed(mockPool);
    const row = await controller.retrieveByName("legacy-bot");

    expect(row?.showSources).toBe(true);
    expect(row?.autoScrollTop).toBe(true);
  });

  it("redacts credential fields from debug bot-config logs", async () => {
    const previousDebug = process.env.DEBUG_ENABLED;
    process.env.DEBUG_ENABLED = "true";

    const mockPool: any = {
      query: jest.fn((...args: any[]) => {
        const sql: string = args[0];
        const cb: any = args[args.length - 1];

        if (sql.includes("UPDATE EmbedBot")) {
          cb(null, { affectedRows: 1 });
        } else if (sql.includes("SELECT * FROM `EmbedBot` WHERE `botName`=?")) {
          cb(null, [{ id: 5, botName: "redact-bot" }]);
        } else {
          cb(null, []);
        }
      })
    };

    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    try {
      const controller = new BotEmbed(mockPool);
      await controller.update({
        botName: "redact-bot",
        microsoftAppPassword: "super-secret",
        developerMode: "dev-key"
      } as IBotEmbedConfig);

      expect(logSpy).toHaveBeenCalledWith(
        "Updating bot: ",
        expect.objectContaining({
          microsoftAppPassword: "[REDACTED]",
          developerMode: "[REDACTED]"
        })
      );
      expect(logSpy).not.toHaveBeenCalledWith(
        "Updating bot: ",
        expect.objectContaining({
          microsoftAppPassword: "super-secret",
          developerMode: "dev-key"
        })
      );
    } finally {
      logSpy.mockRestore();
      if (previousDebug === undefined) delete process.env.DEBUG_ENABLED;
      else process.env.DEBUG_ENABLED = previousDebug;
    }
  });
});
