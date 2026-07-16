import express from "express";
import e, { json, NextFunction, Request, Response, urlencoded } from "express";
import swagger from "swagger-ui-express";
import { RegisterRoutes } from "../build/routes.js";
import swaggerJson from "../build/swagger.json";
import { ValidateError } from "tsoa";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { Config } from "./config.js";
import axios from "axios";
import { CriaResponse } from "./models/CriaResponse.js";
import path from "path";
import multer from "multer";

export const app = express();
export const baseRouter = express.Router();

// Number of proxy hops in front of this service, so req.ip is the real client
// (used for rate-limit keying). Too high re-enables XFF spoofing; too low
// collapses everyone onto the proxy IP. Default 1 (single reverse proxy).
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS ?? 1));

// CSP off + CORP cross-origin so the cross-origin embed loader keeps working;
// helmet still adds nosniff, referrer-policy and the other safe defaults.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// The chat widget is embedded on arbitrary third-party customer origins, so the
// public embed/chat/popup routes must accept any origin. Auth is via the
// `X-Api-Key` header (never cookies), so credentials are pinned OFF - a wildcard
// origin combined with credentials would be both spec-invalid and unsafe.
const CORS_OPTIONS: cors.CorsOptions = {
  origin: "*",
  credentials: false,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Authorization",
    "Content-Type",
    "X-Api-Key",
    "X-Requested-With"
  ]
};

/**
 * Rewrite application/json; boundary=<BOUNDARY> as multipart/form-data; boundary=<BOUNDARY>
 *
 * @param req The request object
 * @param _ The response object
 * @param next The next function
 */
function FixContentType(req: e.Request, _: e.Response, next: e.NextFunction) {
  // Extract the Content-Type header
  const contentType = req.headers["content-type"] || "";

  // Check if the Content-Type is mislabeled as JSON but includes a boundary parameter
  if (
    contentType.startsWith("application/json") &&
    contentType.includes("boundary=")
  ) {
    // Extract the boundary value
    const boundary = contentType.split("boundary=")[1];

    // Properly format as multipart/form-data with the correct boundary
    if (boundary) {
      req.headers["content-type"] = `multipart/form-data; boundary=${boundary}`;
    }
  }

  next();
}

app.use(FixContentType);

// Bound in-memory multipart parsing so a hostile upload can't exhaust memory.
// Nothing downstream consumes the files themselves - this path only populates
// req.body form fields - so these caps are generous headroom, not a real limit.
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB per file
    files: 20,
    fields: 200,
    fieldSize: 5 * 1024 * 1024 // 5 MB per field value
  }
});
app.use((req, res, next) => {
  const contentType = req.headers["content-type"];

  if (contentType && contentType.includes("multipart/form-data")) {
    // Use multer to parse the multipart data
    upload.any()(req, res, err => {
      if (err) {
        return res
          .status(400)
          .json({ error: "Error parsing multipart/form-data" });
      }

      // Rewrite the payload to {"a": "b"}
      req.body = { ...req.body };

      // Call the next middleware
      next();
    });
  } else {
    // If not multipart/form-data, just continue
    next();
  }
});

// express middleware
baseRouter.use(
  urlencoded({ extended: true }),
  json(),
  cors(CORS_OPTIONS),
  morgan("dev")
);

// Public assets
baseRouter.use(
  "/public",
  express.static(path.join(Config.ASSETS_FOLDER_PATH, "/public"))
);

// Load swagger when TESTING
if (Config.APP_MODE !== "PRODUCTION") {
  baseRouter.use(
    ["/swagger", "/docs"],
    swagger.serve,
    swagger.setup(swaggerJson, { customCss: ".topbar {display: none;}" })
  );
}

// Fallback preflight handler (cors() above normally answers preflight first).
// Kept consistent with CORS_OPTIONS so it can't contradict the real policy.
baseRouter.options("*", (_, res: Response) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, X-Api-Key, X-Requested-With"
  );
  res.send(200);
});

if (process.env.DEBUG_ENABLED?.toLowerCase() === "true") {
  baseRouter.use((req: Request, res: Response, next: NextFunction) => {
    console.log("--------------------");
    console.log("Received URL:", req.url);
    console.log("Received Body:", req.body);
    console.log("Return Status:", res.statusCode);
    console.log("--------------------");
    next();
  });
}

// Prevent Express leak
app.disable("x-powered-by");

// Register routs
RegisterRoutes(baseRouter);

// Health check endpoint (for docker health checks) - register after routes but before 404 handler
baseRouter.get("/health_check", (_: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "CriaEmbed API",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || "1.0.0"
  });
});

// Lightweight diagnostic endpoint to validate connectivity to external dependencies (e.g., Criabot)
baseRouter.get("/manage/_diagnose", async (_: Request, res: Response) => {
  // Unauthenticated endpoint - do NOT expose the internal criabot URL here.
  const diagnostics: any = {
    service: "CriaEmbed API",
    timestamp: Date.now(),
    criabot: {
      reachable: false,
      status: null,
      error: null
    }
  };

  try {
    const url =
      (Config.CRIA_BOT_SERVER_URL || "").replace(/\/$/, "") + "/health_check";
    const r = await axios.get(url, { timeout: 3000 });
    diagnostics.criabot.reachable = true;
    diagnostics.criabot.status = r.status;
  } catch (e: any) {
    // Report only the error code - the message can embed the internal URL/host.
    diagnostics.criabot.error = e?.code || "UNREACHABLE";
  }

  res.status(200).json({ status: "ok", diagnostics });
});

// Basic handler for errors
baseRouter.use(
  (err: unknown, req: Request, res: Response, next: NextFunction) => {
    // From docs, may as well keep
    if (err instanceof ValidateError) {
      console.warn(`Caught Validation Error for ${req.path}:`, err.fields);

      const payload: CriaResponse = {
        timestamp: Date.now().toString(),
        status: 422,
        code: "INVALID",
        message: "Invalid payload, sorry man.",
        detail: err.fields
      };

      return res.status(payload.status).json(payload);
    } else if (err instanceof SyntaxError) {
      console.warn(`Caught Validation Error for ${req.path}:`, err.stack);

      const payload: CriaResponse = {
        timestamp: Date.now().toString(),
        status: 422,
        code: "INVALID",
        message: "Invalid JSON payload, sorry man."
      };

      return res.status(payload.status).json(payload);
    }

    // Generic handler
    else if (err instanceof Error) {
      console.warn(`Caught Error for ${req.path}:`, err.stack);

      const payload: CriaResponse = {
        timestamp: Date.now().toString(),
        status: 500,
        code: "ERROR",
        message: "An error occurred! Check the console for the stacktrace."
      };

      return res.status(payload.status).json(payload);
    }

    next();
  }
);

// Not found handler
baseRouter.use((_: Request, res: Response) => {
  const payload: CriaResponse = {
    timestamp: Date.now().toString(),
    status: 404,
    code: "NOT_FOUND",
    message: "Route not found."
  };

  res.status(payload.status).json(payload);
});

app.use(baseRouter);
