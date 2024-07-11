// noinspection JSUnusedGlobalSymbols

export default class CriaConfig {

    // Private Vars
    #href;
    #url;

    // App-defined items (not passed initially)
    originalChatId;

    // "Data-class" items
    embedTheme;
    webAppUrl;
    chatApiUrl;
    botId;
    botName;
    botSubName;
    botGreeting;
    botGreetingId;
    botIconUrl;
    chatId;
    criaSiteUrl;
    watermarkEnabled;
    botLocale;
    initialPrompts;

    constructor(href) {
        this.#href = href;
        this.#url = new URL(href);

        // Build class
        this.#build();
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

            let decoded = decodeURIComponent(atob(res));
            try {
                this[key] = JSON.parse(decoded);
            } catch (ex) {
                this[key] = decoded;
            }

        }
    }

}


