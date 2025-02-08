import {RemoteStore} from "@/hooks/stores/remote-store.ts";
import {EmbedConfigResponse, EmbedPublicConfig} from "@/sdk";
import {AxiosResponse} from "axios";

export default class Config extends RemoteStore<EmbedPublicConfig> {

  constructor() {
    super("config");
  }

  async queryFn() {
    const response: AxiosResponse<EmbedConfigResponse> = await this.sdk.embed.embedGetConfig(this.botId, this.chatId);
    return response.config;
  }

}

