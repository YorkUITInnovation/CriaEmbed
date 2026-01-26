import {Controller} from "tsoa";
import {BaseService} from "../services/BaseService.js";
import {debugEnabled} from "../config.js";


interface IController {
  service: BaseService;
}

export abstract class BaseController extends Controller implements IController {

  abstract service: BaseService;

  protected constructor() {
    super();
  }

  setStatus(statusCode: number, error: Error | undefined = undefined): void {
    super.setStatus(statusCode);
    if (error !== undefined && debugEnabled()) {
      console.error("Received Error:", error);
    }
  }

  setHeader(name: string, value: string): void {
    super.setHeader(name, value);
  }

}
