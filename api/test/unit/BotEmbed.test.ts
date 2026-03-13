import {BotEmbed, IBotEmbedConfig, IBotEmbed} from '../../src/database/mysql/controllers/BotEmbed';

describe('BotEmbed (DB controller) - Insert/Update value handling', () => {
  it('should convert undefined boolean fields to NULL and not insert NaN (insert)', async () => {
    const captured: { sqls: string[]; valuesList: any[][] } = { sqls: [], valuesList: [] };

    const mockPool: any = {
      query: jest.fn((...args: any[]) => {
        // normalize arguments: (sql, values?, cb)
        const sql: string = args[0];
        let values: any[] = [];
        let cb: any = args[args.length - 1];
        if (args.length === 2 && typeof args[1] === 'function') {
          values = [];
          cb = args[1];
        } else if (args.length >= 3) {
          values = args[1];
        }

        captured.sqls.push(sql);
        captured.valuesList.push(values);

        if (sql.includes('INSERT INTO `EmbedBot`')) {
          // simulate insert result
          cb(null, { insertId: 42 });
        } else if (sql.includes('SELECT * FROM `EmbedBot` WHERE `id`=?')) {
          // returned row should match expectations (nulls for optional fields)
          cb(null, [
            {
              id: 42,
              botName: 'test-bot-1',
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
      botName: 'test-bot-1'
      // intentionally omit optional boolean fields and initialPrompts
    } as IBotEmbedConfig;

    const inserted = await controller.insert(cfg);

    // Ensure the insert query was executed
    expect(captured.sqls.length).toBeGreaterThan(0);
    const insertIdx = captured.sqls.findIndex(s => s.includes('INSERT INTO `EmbedBot`'));
    const insertValues = insertIdx >= 0 ? captured.valuesList[insertIdx] : captured.valuesList[0];

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
    expect(inserted.botName).toBe('test-bot-1');
    expect(inserted.botWatermark).toBeNull();
    expect(inserted.botEmbedDefaultEnabled).toBeNull();
  });

  it('should convert boolean true/false to 1/0 (insert)', async () => {
    const captured: { sqls: string[]; valuesList: any[][] } = { sqls: [], valuesList: [] };

    const mockPool: any = {
      query: jest.fn((...args: any[]) => {
        const sql: string = args[0];
        let values: any[] = [];
        let cb: any = args[args.length - 1];
        if (args.length === 2 && typeof args[1] === 'function') {
          values = [];
          cb = args[1];
        } else if (args.length >= 3) {
          values = args[1];
        }

        captured.sqls.push(sql);
        captured.valuesList.push(values);

        if (sql.includes('INSERT INTO `EmbedBot`')) {
          cb(null, { insertId: 99 });
        } else if (sql.includes('SELECT * FROM `EmbedBot` WHERE `id`=?')) {
          cb(null, [
            {
              id: 99,
              botName: 'test-bool',
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
      botName: 'test-bool',
      botWatermark: true,
      integrationsNoContextReply: false,
      integrationsFirstEmailOnly: true,
      botEmbedDefaultEnabled: false,
      initialPrompts: []
    } as IBotEmbedConfig;

    const inserted = await controller.insert(cfg);

    // booleans should be converted to 1/0
    const insertIdx = captured.sqls.findIndex(s => s.includes('INSERT INTO `EmbedBot`'));
    const insertValues = insertIdx >= 0 ? captured.valuesList[insertIdx] : captured.valuesList[0];

    expect(insertValues[6]).toBe(1);
    expect(insertValues[12]).toBe(0);  // integrationsNoContextReply (shifted by +1)
    expect(insertValues[13]).toBe(1);  // integrationsFirstEmailOnly (shifted by +1)
    expect(insertValues[15]).toBe(0);  // botEmbedDefaultEnabled (shifted by +1)

    // initialPrompts serialized
    expect(insertValues[8]).toBe(JSON.stringify([]));

    expect(inserted.botName).toBe('test-bool');
    expect(inserted.botWatermark).toBe(true);
  });

  it('should treat initialPrompts undefined as NULL on update and not send NaN', async () => {
    const captured: { sqls: string[]; valuesList: any[][] } = { sqls: [], valuesList: [] };

    const mockPool: any = {
      query: jest.fn((...args: any[]) => {
        const sql: string = args[0];
        let values: any[] = [];
        let cb: any = args[args.length - 1];
        if (args.length === 2 && typeof args[1] === 'function') {
          values = [];
          cb = args[1];
        } else if (args.length >= 3) {
          values = args[1];
        }

        captured.sqls.push(sql);
        captured.valuesList.push(values);

        if (sql.includes('UPDATE EmbedBot')) {
          cb(null, { affectedRows: 1 });
        } else if (sql.includes('SELECT * FROM `EmbedBot` WHERE `botName`=?')) {
          cb(null, [
            {
              id: 55,
              botName: 'test-update',
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
      botName: 'test-update'
      // nothing else - omitted fields
    } as IBotEmbedConfig;

    const res = await controller.update(cfg);

    // We recorded all SQL statements - ensure one of them was the UPDATE
    expect(captured.sqls.some(s => s.includes('UPDATE EmbedBot'))).toBe(true);

    // find the UPDATE call's values (it should be the one whose sql includes 'UPDATE EmbedBot')
    const updateIdx = captured.sqls.findIndex(s => s.includes('UPDATE EmbedBot'));
    const updateValues = captured.valuesList[updateIdx];

    // Check positions of boolean conversions in update values: botWatermark at index 5
    expect(updateValues[5]).toBeNull();
    // initialPrompts index 7
    expect(updateValues[7]).toBeNull();

    expect(res?.botName).toBe('test-update');
    expect(res?.botWatermark).toBeNull();
  });

});
