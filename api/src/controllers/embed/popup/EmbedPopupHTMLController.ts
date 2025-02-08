import {Example, Get, Middlewares, OperationId, Path, Produces, Request, Route, Tags} from "tsoa";
import {BaseController} from "../../../models/BaseController";
import {EmbedService} from "../../../services/EmbedService";
import {RATE_LIMIT_EMBED_ALL_HANDLERS} from "../../../models/LimitGenerator";
import fs from "fs";
import path from "path";
import {Config} from "../../../config";
import e from "express";


const EMBED_BASE_SCRIPT: string = fs.readFileSync(
    path.join(Config.ASSETS_FOLDER_PATH, "/public/popup/embed.html")
).toString();

@Route("/embed/{botId}/popup.html")
export class EmbedPopupHTMLController extends BaseController {

  constructor(
      public service: EmbedService = new EmbedService()
  ) {
    super();
  }

  @Get()
  @Tags("Embed")
  @Example<string>(
      "(async function(){console.log('Cria popup script')})()", "SUCCESS",
  )
  @Produces("application/javascript")
  @Middlewares(...RATE_LIMIT_EMBED_ALL_HANDLERS)
  @OperationId("embedGetPopupHtml")
  public async getPopupEmbedHtml(
      @Path() botId: string,
      @Request() request: e.Request,
  ): Promise<string> {

    const embedPopupScript = (EMBED_BASE_SCRIPT + " ").replaceAll(/\$botId/g, botId);

    this.setStatus(200);

    this.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    this.setHeader("Pragma", "no-cache");
    this.setHeader("Expires", "0");

    // Tsoa plaintext is broken, we gotta hack it
    request.res?.setHeader("Content-Type", "application/javascript; charset=utf-8")
    request.res?.send(embedPopupScript);
    return "";

  }


}
