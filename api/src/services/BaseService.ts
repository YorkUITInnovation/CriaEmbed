import { Pool } from "mysql2";
import { Config } from "../config.js";
import axios, { AxiosRequestConfig, AxiosResponse } from "axios";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";

const agentOptions = {
  keepAlive: true,
  maxSockets: 64,
  maxTotalSockets: 256,
  maxFreeSockets: 16,
  scheduling: "lifo" as const
};
const httpAgent = new HttpAgent(agentOptions);
const httpsAgent = new HttpsAgent(agentOptions);

export abstract class BaseService {
  protected mySqlPool?: Pool;
  private criaWebServiceBaseUrl: string = `${Config.CRIA_SERVER_URL}/webservice/rest/server.php`;

  protected constructor(pool?: Pool) {
    this.mySqlPool = pool;
  }

  protected buildServiceURL(
    wsFunction: string,
    wsParams?: { [key: string]: string }
  ) {
    wsParams = wsParams || {};

    const wsPreParams = {
      wstoken: Config.CRIA_SERVER_TOKEN,
      moodlewsrestformat: "json",
      wsfunction: wsFunction
    };

    return (
      this.criaWebServiceBaseUrl +
      "?" +
      new URLSearchParams(wsPreParams).toString() +
      "&" +
      new URLSearchParams(wsParams).toString()
    );
  }

  private handleConfig(config?: AxiosRequestConfig): AxiosRequestConfig {
    const baseConfig: AxiosRequestConfig = config ? { ...config } : {};

    if (baseConfig.httpAgent === undefined) {
      baseConfig.httpAgent = httpAgent;
    }
    if (baseConfig.httpsAgent === undefined) {
      baseConfig.httpsAgent = httpsAgent;
    }

    // Default timeout if not provided
    if (baseConfig.timeout === undefined) {
      baseConfig.timeout = 30000; // 30 seconds
    }

    // Only treat 2xx responses as success unless caller overrides
    // Don't override if validateStatus is explicitly provided
    if (baseConfig.validateStatus === undefined) {
      baseConfig.validateStatus = (status: number) =>
        status >= 200 && status < 300;
    }

    return baseConfig;
  }

  protected async post(
    url: string,
    data?: object,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse> {
    return await axios.post(url, data, this.handleConfig(config));
  }

  protected async get(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse> {
    return await axios.get(url, this.handleConfig(config));
  }
}
