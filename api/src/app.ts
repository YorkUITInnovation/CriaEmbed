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

/**
 * Rewrite application/json; boundary=<BOUNDARY> as multipart/form-data; boundary=<BOUNDARY>
 *
 * @param req The request object
 * @param _ The response object
 * @param next The next function
 */
function FixContentType(req: e.Request, _: e.Response, next: e.NextFunction) {
  // Extract the Content-Type header
  const contentType = req.headers['content-type'] || '';

  // Check if the Content-Type is mislabeled as JSON but includes a boundary parameter
  if (contentType.startsWith('application/json') && contentType.includes('boundary=')) {
    // Extract the boundary value
    const boundary = contentType.split('boundary=')[1];

    // Properly format as multipart/form-data with the correct boundary
    if (boundary) {
      req.headers['content-type'] = `multipart/form-data; boundary=${boundary}`;
    }
  }

  next();
}

app.use(FixContentType);


const upload = multer();
app.use((req, res, next) => {
  const contentType = req.headers['content-type'];

  if (contentType && contentType.includes('multipart/form-data')) {
    // Use multer to parse the multipart data
    upload.any()(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: 'Error parsing multipart/form-data' });
      }

      // Rewrite the payload to {"a": "b"}
      req.body = {...req.body};

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

