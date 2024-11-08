import express from "express";
import e, {json, NextFunction, Request, Response, urlencoded} from "express";
import swagger from "swagger-ui-express";
import {RegisterRoutes} from "../build/routes";
import swaggerJson from "../build/swagger.json";
import {ValidateError} from "tsoa";
import cors from "cors";
import morgan from "morgan";
import {Config} from "./config";
import {CriaResponse} from "./models/CriaResponse";
import path from "path";
import multer from "multer";

export const app = express();
export const baseRouter = express.Router();
export const upload = multer();

const multipartToJson = upload.any(); // 'any' accepts all files and fields

/**
 * This middleware converts multipart uploads to JSON before it hits the router layer.
 * As long as we don't have to deal with files, we can convert the multipart form to JSON.
 * The embed server should never need that, so this 'fix' works. This is required because the
 * version of Moodle on eClass has a weird behaviour that rewrites JSON requests to multipart, so we need to back-convert.
 */
const multipartConverterMiddleware = (
    req: e.Request,
    res: e.Response,
    next: e.NextFunction
) => {

  multipartToJson(req, res, (err) => {
    // If error, let the downstream middlewares handle it
    if (err) {
      return next(err);
    }

    // Initialize body if it doesn't exist
    req.body ||= {};

    // If files exist, convert them to strings
    if (req.files) {
      for (let file of Object.values(req.files)) {
        req.body[file.fieldname] = file.buffer.toString("utf-8");
      }
    }
    next()
  });

}

// express middleware
baseRouter.use(
    multipartConverterMiddleware,
    urlencoded({extended: true}),
    json(),
    cors(),
    morgan("dev")
);

// Public assets
baseRouter.use('/public', express.static(path.join(Config.ASSETS_FOLDER_PATH, '/public')))


// Load swagger when TESTING
if (Config.APP_MODE !== "PRODUCTION") {
  baseRouter.use(["/swagger", "/docs"], swagger.serve, swagger.setup(swaggerJson, {"customCss": ".topbar {display: none;}"}));
}

// CORS handling
baseRouter.options("*", (_, res: Response) => {
  res.header('Access-Control-Allow-Origin', "*")
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Length, X-Requested-With');
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

// Basic handler for errors
baseRouter.use((err: unknown, req: Request, res: Response, next: NextFunction) => {

  // From docs, may as well keep
  if (err instanceof ValidateError) {
    console.warn(`Caught Validation Error for ${req.path}:`, err.fields);

    const payload: CriaResponse = {
      timestamp: Date.now().toString(),
      status: 422,
      code: "INVALID",
      message: "Invalid payload, sorry man.",
      detail: err.fields
    }

    return res.status(payload.status).json(payload);

  } else if (err instanceof SyntaxError) {
    console.warn(`Caught Validation Error for ${req.path}:`, err.stack);

    const payload: CriaResponse = {
      timestamp: Date.now().toString(),
      status: 422,
      code: "INVALID",
      message: "Invalid JSON payload, sorry man."
    }

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
    }

    return res.status(payload.status).json(payload);

  }

  next();

});

// Not found handler
baseRouter.use((_: Request, res: Response) => {
      const payload: CriaResponse = {
        timestamp: Date.now().toString(),
        status: 404,
        code: "NOT_FOUND",
        message: "Route not found."
      }

      res.status(payload.status).json(
          payload
      );
    }
);

app.use(baseRouter);

