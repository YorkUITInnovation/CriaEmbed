import {
  Example,
  Get,
  Middlewares,
  Path,
  Produces,
  Request,
  Route,
  Tags
} from "tsoa";
import { BaseController } from "../../../models/BaseController.js";
import { EmbedService } from "../../../services/EmbedService.js";
import { RATE_LIMIT_EMBED_ALL_HANDLERS } from "../../../models/LimitGenerator.js";
import { htmlAttrEscape } from "../../../models/htmlEscape.js";
import fs from "fs";
import path from "path";
import { Config } from "../../../config.js";
import e from "express";

// Matches criabot's bot-name cap; also bounds the reflected payload size.
const MAX_BOT_ID_LENGTH = 128;

const EMBED_BASE_SCRIPT: string = fs
  .readFileSync(
    path.join(Config.ASSETS_FOLDER_PATH, "/public/popup/embed.html")
  )
  .toString();

@Route("/embed/{botId}/popup.html")
export class EmbedPopupHTMLController extends BaseController {
  constructor(public service: EmbedService = new EmbedService()) {
    super();
  }

  @Get()
  @Tags("Embed")
  @Example<string>(
    "(async function(){console.log('Cria popup script')})()",
    "SUCCESS"
  )
  @Produces("application/javascript")
  @Middlewares(...RATE_LIMIT_EMBED_ALL_HANDLERS)
  public async getPopupEmbedHtml(
    @Path() botId: string,
    @Request() request: e.Request
  ): Promise<string> {
    // botId comes straight from the URL path and is reflected into this markup,
    // so it must be output-encoded per context to prevent XSS:
    //  - $botId       -> HTML attribute value (transparent to the [botId='..'] selectors)
    //  - $botIdJsKey  -> a JS string key inside an inline onclick; JSON.stringify handles
    //                    the JS-string escaping, htmlAttrEscape keeps it inside the attribute.
    // Replace the longer token first ($botId is a prefix of $botIdJsKey).
    const safeBotId =
      botId.length > MAX_BOT_ID_LENGTH
        ? botId.slice(0, MAX_BOT_ID_LENGTH)
        : botId;
    const botIdAttr = htmlAttrEscape(safeBotId);
    const botIdJsKey = htmlAttrEscape(JSON.stringify(safeBotId));
    const embedPopupScript = (EMBED_BASE_SCRIPT + " ")
      .replaceAll(/\$botIdJsKey/g, botIdJsKey)
      .replaceAll(/\$botId/g, botIdAttr);

    this.setStatus(200);

    this.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    this.setHeader("Pragma", "no-cache");
    this.setHeader("Expires", "0");

    // Tsoa plaintext is broken, we gotta hack it
    request.res?.setHeader(
      "Content-Type",
      "application/javascript; charset=utf-8"
    );
    request.res?.send(embedPopupScript);
    return "";
  }
}
