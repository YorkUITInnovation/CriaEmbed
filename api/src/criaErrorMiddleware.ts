import type { ErrorRequestHandler } from "express";
import { CriaError } from "./models/CriaResponse.js";

export const criaErrorMiddleware: ErrorRequestHandler = (
  error,
  req,
  res,
  next
) => {
  if (!(error instanceof CriaError)) {
    next(error);
    return;
  }
  if (res.headersSent) {
    next(error);
    return;
  }
  console.warn(
    `Caught Cria Error for ${req.path}: HTTP ${error.payload.status}`
  );
  res.status(error.payload.status).json(error.payload);
};
