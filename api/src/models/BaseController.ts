import {Controller} from "tsoa";
import {BaseService} from "../services/BaseService";


interface IController {
    service: BaseService;
}

export abstract class BaseController extends Controller implements IController {

    abstract service: BaseService;

    protected constructor() {
        super();
    }


}
