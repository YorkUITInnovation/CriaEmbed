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


  constructor(href) {
    this.#href = href;
    this.#url = new URL(href);

    // Build class
    this.#build();
    console.log(this);
  }

  async fetchConfig() {

    // Fetch the config
    let res = await fetch(this.chatApiUrl + "/embed/" + this.botId + "/config?chatId=" + this.chatId);
    let responseData = await res.json();

    // Set the values
    for (const key of Object.keys(responseData.config)) {
      this[key] = responseData.config[key];
    }
  }

  // Fill class from URL
  #build() {

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


