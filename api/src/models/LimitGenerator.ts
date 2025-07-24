import rateLimit, {
  RateLimitExceededEventHandler,
  RateLimitRequestHandler,
  ValueDeterminingMiddleware
} from "express-rate-limit";
import {CriaResponse} from "./CriaResponse";
import {Options} from "express-rate-limit/dist";
import {Request, Response} from "express";
import {Config} from "../config";


function generateHandler(message?: string): RateLimitExceededEventHandler {

  function handler(_: Request, res: Response): void {

    const payload: CriaResponse = {
      timestamp: Date.now().toString(),
      status: 429,
      code: "TOO_MANY_REQUESTS",
      message: message || "You hit the rate limit for this (to prevent accidents or abuse costing $20,000 in a day)"
    }

    res.status(429).json(payload);
  }

  return handler;

}


export default function LimitGenerator(
    options: Partial<Options>,
    keyGenerators: Array<ValueDeterminingMiddleware<string>>
): RateLimitRequestHandler[] {
  const limiters: RateLimitRequestHandler[] = [];

  for (const generator of keyGenerators) {
    options["keyGenerator"] = generator;
    options["handler"] = generateHandler(options.message);

    limiters.push(
        rateLimit(options)
    );

  }

  return limiters;

}


function getIP(req: Request): string {
  return req.headers['x-forwarded-for']?.toString() || req.ip as string;
}


const KEY_GENERATORS: ValueDeterminingMiddleware<string>[] = [
  async (req: Request, _: Response): Promise<string> => getIP(req),
  async (req: Request, _: Response): Promise<string> => req.headers['Host']?.toString() || getIP(req)
]


const RATE_LIMIT_CHAT_MINUTE_HANDLERS = LimitGenerator(
    {windowMs: 1000 * 60, limit: parseInt(Config.RATE_LIMIT_CHAT_MINUTE_MAX)}, KEY_GENERATORS
)

const RATE_LIMIT_CHAT_HOUR_HANDLERS = LimitGenerator(
    {windowMs: 1000 * 60 * 60, limit: parseInt(Config.RATE_LIMIT_CHAT_HOUR_MAX)}, KEY_GENERATORS
)

const RATE_LIMIT_CHAT_DAY_HANDLERS = LimitGenerator(
    {windowMs: 1000 * 60 * 60 * 24, limit: parseInt(Config.RATE_LIMIT_CHAT_DAY_MAX)}, KEY_GENERATORS
)

const RATE_LIMIT_EMBED_MINUTE_HANDLERS = LimitGenerator(
    {windowMs: 1000 * 60, limit: parseInt(Config.RATE_LIMIT_EMBED_MINUTE_MAX)}, KEY_GENERATORS
)

const RATE_LIMIT_EMBED_HOUR_HANDLERS = LimitGenerator(
    {windowMs: 1000 * 60 * 60, limit: parseInt(Config.RATE_LIMIT_EMBED_HOUR_MAX)}, KEY_GENERATORS
)

const RATE_LIMIT_EMBED_DAY_HANDLERS = LimitGenerator(
    {windowMs: 1000 * 60 * 60 * 24, limit: parseInt(Config.RATE_LIMIT_EMBED_DAY_MAX)}, KEY_GENERATORS
)

export const RATE_LIMIT_CHAT_ALL_HANDLERS = [
  ...RATE_LIMIT_CHAT_MINUTE_HANDLERS, ...RATE_LIMIT_CHAT_HOUR_HANDLERS, ...RATE_LIMIT_CHAT_DAY_HANDLERS
]

export const RATE_LIMIT_EMBED_ALL_HANDLERS = [
  ...RATE_LIMIT_EMBED_MINUTE_HANDLERS, ...RATE_LIMIT_EMBED_HOUR_HANDLERS, ...RATE_LIMIT_EMBED_DAY_HANDLERS
]
