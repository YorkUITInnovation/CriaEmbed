import {
  UsageLog,
  IEmbedUsageLogInsert
} from "../../src/database/mysql/controllers/UsageLog";

function makeMockPool(handlers: {
  onInsert?: (sql: string, values: any[]) => any;
  onSelect?: (sql: string, values: any[]) => any[];
  onCount?: (sql: string, values: any[]) => number;
}) {
  return {
    query: jest.fn((sql: string, values: any[], cb: any) => {
      if (sql.includes("INSERT INTO")) {
        cb(null, {
          insertId: handlers.onInsert ? handlers.onInsert(sql, values) : 1
        });
      } else if (sql.includes("SELECT COUNT(*)")) {
        cb(null, [
          { total: handlers.onCount ? handlers.onCount(sql, values) : 0 }
        ]);
      } else if (sql.includes("SELECT * FROM")) {
        cb(null, handlers.onSelect ? handlers.onSelect(sql, values) : []);
      } else {
        cb(null, []);
      }
    })
  };
}

describe("UsageLog (DB controller)", () => {
  const baseRow: IEmbedUsageLogInsert = {
    bot_id: 1,
    userid: null,
    prompt: "hello",
    message: "hi there",
    index_context: JSON.stringify({ group: "docs" }),
    confidence: null,
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
    cost: 0.001,
    payload: JSON.stringify({ request: {}, response: {} }),
    ip: "127.0.0.1",
    other: null,
    timecreated: 1700000000
  };

  it("inserts a row and returns the insert id", async () => {
    const pool = makeMockPool({ onInsert: () => 99 });
    const usageLog = new UsageLog(pool as any);

    const id = await usageLog.insert(baseRow);

    expect(id).toBe(99);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO `EmbedUsageLog`"),
      expect.arrayContaining([1, null, "hello", "hi there"]),
      expect.any(Function)
    );
  });

  it("rejects when the insert query errors", async () => {
    const pool = {
      query: jest.fn((sql: string, values: any[], cb: any) =>
        cb(new Error("db down"))
      )
    };
    const usageLog = new UsageLog(pool as any);

    await expect(usageLog.insert(baseRow)).rejects.toThrow("db down");
  });

  it("filters by bot_id/userid/timecreated range and paginates", async () => {
    const rows = [{ id: 1, ...baseRow }];
    const pool = makeMockPool({
      onSelect: () => rows,
      onCount: () => 1
    });
    const usageLog = new UsageLog(pool as any);

    const page = await usageLog.find(
      { bot_id: 1, userid: 2, timecreated_from: 100, timecreated_to: 200 },
      1,
      20
    );

    expect(page.items).toEqual(rows);
    expect(page.total).toBe(1);

    const selectCall = (pool.query as jest.Mock).mock.calls.find(call =>
      call[0].includes("SELECT * FROM")
    );
    expect(selectCall[0]).toContain("bot_id = ?");
    expect(selectCall[0]).toContain("userid = ?");
    expect(selectCall[0]).toContain("timecreated >= ?");
    expect(selectCall[0]).toContain("timecreated <= ?");
    expect(selectCall[1]).toEqual([1, 2, 100, 200, 20, 0]);
  });

  it("clamps page/limit to sane bounds", async () => {
    const pool = makeMockPool({ onSelect: () => [], onCount: () => 0 });
    const usageLog = new UsageLog(pool as any);

    await usageLog.find({}, 0, 10000);

    const selectCall = (pool.query as jest.Mock).mock.calls.find(call =>
      call[0].includes("SELECT * FROM")
    );
    // page clamped to 1 -> offset 0, limit clamped to 200
    expect(selectCall[1]).toEqual([200, 0]);
  });
});
