jest.mock("tsoa", () => {
  const decorator = () => () => undefined;
  class MockController {
    private status = 200;
    public setStatus(statusCode: number): void {
      this.status = statusCode;
    }
    public getStatus(): number {
      return this.status;
    }
  }
  return {
    Controller: MockController,
    Get: decorator,
    Header: decorator,
    Query: decorator,
    Route: decorator,
    Tags: decorator
  };
});

import { UsageLogController } from "../../src/controllers/internal/UsageLogController";
import { Config } from "../../src/config";

describe("UsageLogController", () => {
  let service: { listUsageLogs: jest.Mock };
  let controller: UsageLogController;

  beforeEach(() => {
    service = { listUsageLogs: jest.fn() };
    controller = new UsageLogController(service as any);
  });

  it("rejects requests without a valid internal token", async () => {
    const result = await controller.list("wrong-token");

    expect(result.status).toBe(401);
    expect(result.code).toBe("UNAUTHORIZED");
    expect(service.listUsageLogs).not.toHaveBeenCalled();
  });

  it("rejects requests with no token at all", async () => {
    const result = await controller.list(undefined as any);

    expect(result.status).toBe(401);
    expect(service.listUsageLogs).not.toHaveBeenCalled();
  });

  it("returns paginated items when the token is valid", async () => {
    service.listUsageLogs.mockResolvedValueOnce({
      items: [{ id: 1, bot_id: 7, message: "hi" }],
      total: 1
    });

    const result = await controller.list(
      Config.EMBED_INTERNAL_TOKEN,
      7,
      undefined,
      undefined,
      undefined,
      undefined,
      2,
      10
    );

    expect(service.listUsageLogs).toHaveBeenCalledWith(
      {
        bot_id: 7,
        bot_name: undefined,
        userid: undefined,
        timecreated_from: undefined,
        timecreated_to: undefined
      },
      2,
      10
    );
    expect(result.status).toBe(200);
    expect(result.code).toBe("SUCCESS");
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });

  it("forwards bot_name filtering to the service", async () => {
    service.listUsageLogs.mockResolvedValueOnce({ items: [], total: 0 });

    await controller.list(Config.EMBED_INTERNAL_TOKEN, undefined, "mock-bot");

    expect(service.listUsageLogs).toHaveBeenCalledWith(
      {
        bot_id: undefined,
        bot_name: "mock-bot",
        userid: undefined,
        timecreated_from: undefined,
        timecreated_to: undefined
      },
      1,
      50
    );
  });

  it("returns a 500 envelope when the service throws", async () => {
    service.listUsageLogs.mockRejectedValueOnce(new Error("db down"));

    const result = await controller.list(Config.EMBED_INTERNAL_TOKEN);

    expect(result.status).toBe(500);
    expect(result.code).toBe("ERROR");
  });
});
