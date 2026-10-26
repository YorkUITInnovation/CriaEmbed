import { Body, Get, Header, Post, Query, Route, Tags } from "tsoa";
import { BaseController } from "../../models/BaseController.js";
import { EmbedService } from "../../services/EmbedService.js";
import type { UsageLogCreateBody } from "../../services/EmbedService.js";
import { CriaResponse } from "../../models/CriaResponse.js";
import { Config } from "../../config.js";
import { IEmbedUsageLog } from "../../database/mysql/controllers/UsageLog.js";

const INTERNAL_TOKEN_HEADER = "X-Internal-Token";

interface UsageLogListResponse extends CriaResponse {
  items?: IEmbedUsageLog[];
  page?: number;
  limit?: number;
  total?: number;
}

interface UsageLogCreateResponse extends CriaResponse {
  id?: number;
}

// Server-to-server only: called by Criabot's usage-log gateway endpoint, never
// by the public embed widget. Gated by a shared secret distinct from the
// widget's per-bot X-Api-Key.
@Tags("Internal")
@Route("internal/usage-logs")
export class UsageLogController extends BaseController {
  constructor(public service: EmbedService = new EmbedService()) {
    super();
  }

  @Get()
  public async list(
    @Header(INTERNAL_TOKEN_HEADER) internalToken: string,
    @Query() bot_id?: number,
    @Query() bot_name?: string,
    @Query() userid?: number,
    @Query() timecreated_from?: number,
    @Query() timecreated_to?: number,
    @Query() page: number = 1,
    @Query() limit: number = 50
  ): Promise<UsageLogListResponse> {
    if (
      !Config.EMBED_INTERNAL_TOKEN ||
      internalToken !== Config.EMBED_INTERNAL_TOKEN
    ) {
      this.setStatus(401);
      return {
        message: "Invalid or missing internal token.",
        status: 401,
        code: "UNAUTHORIZED",
        timestamp: Date.now().toString()
      };
    }

    try {
      const { items, total } = await this.service.listUsageLogs(
        { bot_id, bot_name, userid, timecreated_from, timecreated_to },
        page,
        limit
      );

      this.setStatus(200);
      return {
        items,
        page,
        limit,
        total,
        message: "Successfully retrieved usage logs.",
        status: 200,
        code: "SUCCESS",
        timestamp: Date.now().toString()
      };
    } catch (e: any) {
      console.error("[UsageLogController] Failed to list usage logs:", e);
      this.setStatus(500);
      return {
        message: "Internal error occurred while retrieving usage logs.",
        status: 500,
        code: "ERROR",
        timestamp: Date.now().toString()
      };
    }
  }

  // Write path for Criabot: criabot logs every non-embed chat (and failures)
  // here so one store covers all bot traffic. Embed-originated chats keep
  // logging from EmbedService and are excluded criabot-side via the
  // X-Cria-Usage-Source header.
  @Post()
  public async create(
    @Header(INTERNAL_TOKEN_HEADER) internalToken: string,
    @Body() body: UsageLogCreateBody
  ): Promise<UsageLogCreateResponse> {
    if (
      !Config.EMBED_INTERNAL_TOKEN ||
      internalToken !== Config.EMBED_INTERNAL_TOKEN
    ) {
      this.setStatus(401);
      return {
        message: "Invalid or missing internal token.",
        status: 401,
        code: "UNAUTHORIZED",
        timestamp: Date.now().toString()
      };
    }

    if (!body || typeof body.bot_name !== "string" || !body.bot_name.trim()) {
      this.setStatus(400);
      return {
        message: "bot_name is required.",
        status: 400,
        code: "INVALID",
        timestamp: Date.now().toString()
      };
    }

    try {
      const id = await this.service.createUsageLog(body);
      if (id === null) {
        this.setStatus(404);
        return {
          message: `Bot '${body.bot_name}' was not found.`,
          status: 404,
          code: "NOT_FOUND",
          timestamp: Date.now().toString()
        };
      }

      this.setStatus(200);
      return {
        id,
        message: "Usage log recorded.",
        status: 200,
        code: "SUCCESS",
        timestamp: Date.now().toString()
      };
    } catch (e: any) {
      console.error("[UsageLogController] Failed to create usage log:", e);
      this.setStatus(500);
      return {
        message: "Internal error occurred while recording the usage log.",
        status: 500,
        code: "ERROR",
        timestamp: Date.now().toString()
      };
    }
  }
}
