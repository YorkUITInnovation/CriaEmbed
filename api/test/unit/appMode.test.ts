import { appMode } from "../../src/config";

describe("app mode parsing", () => {
  it("keeps development mode explicit", () => {
    expect(appMode("DEVELOPMENT")).toBe("DEVELOPMENT");
    expect(appMode("development")).toBe("DEVELOPMENT");
  });

  it.each([undefined, "", "TEST", "TESTING", "INVALID"])(
    "fails closed to production for mode %s",
    value => {
      expect(appMode(value)).toBe("PRODUCTION");
    }
  );
});
