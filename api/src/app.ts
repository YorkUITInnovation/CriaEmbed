import express, {json, NextFunction, Request, Response, urlencoded} from "express";
import swagger from "swagger-ui-express";
import {RegisterRoutes} from "../build/routes";
import swaggerJson from "../build/swagger.json";
import {ValidateError} from "tsoa";
import cors from "cors";
import morgan from "morgan";
import {Config} from "./config";
import {CriaResponse} from "./models/CriaResponse";
import path from "path";

export const app = express();
export const baseRouter = express.Router();

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

    }

    else if (err instanceof SyntaxError) {
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

