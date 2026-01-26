import {Body, Middlewares, Post, Request, Route, Tags} from "tsoa";
import {BaseController} from "../../models/BaseController.js";
import {EmbedService} from "../../services/EmbedService.js";
import {RATE_LIMIT_CHAT_ALL_HANDLERS} from "../../models/LimitGenerator.js";
import e from "express";
import {AzureService} from "../../services/AzureService.js";


@Tags("Integrations")
@Route("/integrations/azure/messages")
export class AzureIntegrationController extends BaseController {

  private static embedService = new EmbedService();

  constructor(
      public service: AzureService = new AzureService(AzureIntegrationController.embedService)
  ) {
    super();
  }

  @Post()
  @Middlewares(...RATE_LIMIT_CHAT_ALL_HANDLERS)
  public async exists(
      @Request() req: e.Request,
      @Body() _: any
  ): Promise<void> {
    await this.service.handleRequest(req, req.res as e.Response);
  }

}
