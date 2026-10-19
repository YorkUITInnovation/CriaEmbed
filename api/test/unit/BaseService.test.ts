import axios, { AxiosRequestConfig } from "axios";
import { Agent as HttpAgent, createServer } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import { Socket } from "node:net";
import { BaseService } from "../../src/services/BaseService";

class TestService extends BaseService {
  constructor() {
    super();
  }

  requestGet(url: string, config?: AxiosRequestConfig) {
    return this.get(url, config);
  }

  requestPost(url: string, config?: AxiosRequestConfig) {
    return this.post(url, { prompt: "hello" }, config);
  }
}

describe("BaseService HTTP transport", () => {
  afterEach(() => jest.restoreAllMocks());

  it("shares bounded keep-alive agents across requests and service instances", async () => {
    const get = jest.spyOn(axios, "get").mockResolvedValue({ status: 200 });
    const post = jest.spyOn(axios, "post").mockResolvedValue({ status: 200 });
    await new TestService().requestGet("http://upstream.test");
    await new TestService().requestPost("https://upstream.test");
    const getConfig = get.mock.calls[0][1];
    const postConfig = post.mock.calls[0][2];
    expect(getConfig?.httpAgent).toBeInstanceOf(HttpAgent);
    expect(getConfig?.httpsAgent).toBeInstanceOf(HttpsAgent);
    expect(postConfig?.httpAgent).toBe(getConfig?.httpAgent);
    expect(postConfig?.httpsAgent).toBe(getConfig?.httpsAgent);
    for (const agent of [getConfig?.httpAgent, getConfig?.httpsAgent]) {
      expect(agent.options.keepAlive).toBe(true);
      expect(agent.maxSockets).toBe(64);
      expect(agent.maxTotalSockets).toBe(256);
      expect(agent.maxFreeSockets).toBe(16);
    }
    expect(getConfig?.timeout).toBe(30000);
    expect(getConfig?.validateStatus?.(200)).toBe(true);
    expect(getConfig?.validateStatus?.(500)).toBe(false);
  });

  it("preserves caller transport options without mutating the supplied config", async () => {
    const get = jest.spyOn(axios, "get").mockResolvedValue({ status: 200 });
    const httpAgent = new HttpAgent({ keepAlive: false });
    const httpsAgent = new HttpsAgent({ keepAlive: false });
    const config: AxiosRequestConfig = {
      httpAgent,
      httpsAgent,
      timeout: 90000,
      responseType: "stream",
      validateStatus: status => status < 500
    };
    try {
      await new TestService().requestGet("http://upstream.test", config);
      expect(get.mock.calls[0][1]).toEqual(config);
      expect(get.mock.calls[0][1]).not.toBe(config);
      expect(config.httpAgent).toBe(httpAgent);
      expect(config.httpsAgent).toBe(httpsAgent);
    } finally {
      httpAgent.destroy();
      httpsAgent.destroy();
    }
  });

  it("preserves explicit no-agent and zero-timeout overrides", async () => {
    const get = jest.spyOn(axios, "get").mockResolvedValue({ status: 200 });
    await new TestService().requestGet("http://upstream.test", {
      httpAgent: false,
      httpsAgent: false,
      timeout: 0
    });
    expect(get.mock.calls[0][1]).toMatchObject({
      httpAgent: false,
      httpsAgent: false,
      timeout: 0
    });
  });

  it("actually reuses a TCP connection for sequential requests", async () => {
    const sockets = new Set<Socket>();
    let connections = 0;
    const server = createServer((_request, response) => response.end("ok"));
    server.on("connection", socket => {
      connections += 1;
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
    });
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Expected a TCP listener");
      }
      const url = `http://127.0.0.1:${address.port}`;
      const config = { proxy: false as const };
      expect((await new TestService().requestGet(url, config)).data).toBe("ok");
      expect((await new TestService().requestPost(url, config)).data).toBe(
        "ok"
      );
      expect(connections).toBe(1);
    } finally {
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise<void>((resolve, reject) =>
        server.close(error => (error ? reject(error) : resolve()))
      );
    }
  });
});
