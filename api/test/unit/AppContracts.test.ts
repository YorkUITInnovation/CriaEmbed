import fs from "node:fs";
import path from "node:path";

describe("CriaEmbed contract source checks", () => {
  const appSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app.ts"),
    "utf8"
  );
  const routesSource = fs.readFileSync(
    path.resolve(process.cwd(), "build/routes.ts"),
    "utf8"
  );

  it("gates /docs exposure to DEVELOPMENT mode", () => {
    expect(appSource).toContain('if (Config.APP_MODE === "DEVELOPMENT")');
    expect(appSource).toContain('["/swagger", "/docs"]');
  });

  it("allows developer preview headers through browser CORS preflight", () => {
    expect(appSource).toContain('"X-Cria-Dev-Key"');
    expect(routesSource).toContain('"name":"X-Cria-Dev-Key"');
  });

  it("documents X-Api-Key as required for /manage/:botId/config (422 validation path)", () => {
    expect(routesSource).toContain("app.get('/manage/:botId/config'");
    expect(routesSource).toContain(
      'apiKey: {"in":"header","name":"X-Api-Key","required":true'
    );
  });

  it("enforces internal-token auth for /manage/_diagnose", () => {
    expect(appSource).toContain('baseRouter.get("/manage/_diagnose"');
    expect(appSource).toContain("return res.status(401).json({");
    expect(appSource).toContain(
      'message: "Invalid or missing internal token."'
    );
  });

  it("redacts internal URL details from /manage/_diagnose errors", () => {
    expect(appSource).toContain(
      "// Report only the error code - the message can embed the internal URL/host."
    );
    expect(appSource).toContain(
      'diagnostics.criabot.error = e?.code || "UNREACHABLE";'
    );
    expect(appSource).not.toContain("diagnostics.criabot.url");
  });
});
