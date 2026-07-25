// noinspection JSUnusedGlobalSymbols

export default class CriaConfig {
  // Private Vars
  #href;
  #url;

  // App-defined items (not passed initially)
  originalChatId;

  // "Data-class" items
  webAppUrl;
  chatApiUrl;
  botId;
  chatId;

  // Config-loaded values
  embedTheme;
  botName;
  botSubName;
  botGreeting;
  botGreetingId;
  botIconUrl;
  criaSiteUrl;
  watermarkEnabled;
  botLocale;
  initialPrompts;
  botTrustWarning;
  botContact;
  devKey;

  // Diagnostics
  lastConfigError;

  constructor(href) {
    this.#href = href;
    this.#url = new URL(href);

    // Build class
    this.#build();
  }

  async fetchConfig() {
    const required = ["chatApiUrl", "botId", "chatId"];
    const missing = required.filter((key) => {
      const value = this[key];
      return (
        value === undefined || value === null || String(value).trim() === ""
      );
    });

    if (missing.length > 0) {
      const msg = `Missing required embed query params: ${missing.join(", ")}`;
      this.lastConfigError = msg;
      throw new Error(msg);
    }

    // Fetch the config
    const url = new URL(this.chatApiUrl + "/embed/" + this.botId + "/config");
    url.searchParams.set("chatId", this.chatId);
    if (this.devKey) {
      url.searchParams.set("dev-key", this.devKey);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      const body = await res.text();
      const msg = `Embed config request failed (${res.status} ${res.statusText})`;
      this.lastConfigError = `${msg}. URL=${url}. Body=${body.slice(0, 300)}`;
      throw new Error(msg);
    }

    const responseData = await res.json();
    if (
      !responseData ||
      typeof responseData !== "object" ||
      !responseData.config
    ) {
      const msg = "Embed config payload is missing 'config' object";
      this.lastConfigError = `${msg}. URL=${url}. Payload=${JSON.stringify(
        responseData
      ).slice(0, 300)}`;
      throw new Error(msg);
    }

    // Set the values
    for (const key of Object.keys(responseData.config)) {
      this[key] = responseData.config[key];
    }

    this.lastConfigError = undefined;
  }

  // Fill class from URL
  #build() {
    const devKeyParam = this.#url.searchParams.get("devKey");
    const devKeyAltParam = this.#url.searchParams.get("dev-key");
    if (devKeyParam != null) {
      this.devKey = decodeURIComponent(devKeyParam);
    } else if (devKeyAltParam != null) {
      this.devKey = decodeURIComponent(devKeyAltParam);
    }

    for (const key of Object.keys(this)) {
      if (this[key] !== undefined || typeof this[key] === "function") {
        continue;
      }

      let res = this.#url.searchParams.get(key);
      if (res == null) {
        continue;
      }

      let decoded = decodeURIComponent(res);
      try {
        this[key] = JSON.parse(decoded);
      } catch (ex) {
        this[key] = decoded;
      }
    }
  }
}
