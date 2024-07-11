import {MYSQL_POOL} from "../database/mysql/mysql";
import {Pool} from "mysql2";
import {Config} from "../config";
import axios, {AxiosRequestConfig, AxiosResponse} from "axios";

export abstract class BaseService {

    protected mySqlPool: Pool;
    private criaWebServiceBaseUrl: string = `${Config.CRIA_SERVER_URL}/webservice/rest/server.php`

    protected constructor() {
        this.mySqlPool = MYSQL_POOL;
    }

    protected buildServiceURL(wsFunction: string, wsParams?: { [key: string]: string }) {
        wsParams = wsParams || {};

        const wsPreParams = {
            wstoken: Config.CRIA_SERVER_TOKEN,
            moodlewsrestformat: "json",
            wsfunction: wsFunction
        }

        return this.criaWebServiceBaseUrl
            + "?"
            + new URLSearchParams(wsPreParams).toString()
            + "&"
            + new URLSearchParams(wsParams).toString();
    }

    private handleConfig(config?: AxiosRequestConfig): AxiosRequestConfig {
        config = config || {};
        config["validateStatus"] = () => true;
        return config
    }

    protected async post(url: string, data?: object, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        return await axios.post(
            url, data, this.handleConfig(config)
        );
    }

    protected async get(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
        return await axios.get(
            url, this.handleConfig(config)
        )
    }

}
