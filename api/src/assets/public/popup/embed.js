{
  const botId = $botId;
  const hideLauncher = $hideLauncher;

  !async function () {
    window.CRIA ||= {};
    const chatConfig = window.CRIA[botId];

    const hasCriaStyles = !!document.getElementById("cria-styles");
    const rawHTML = await fetch(chatConfig.chatApiUrl + `/embed/${botId}/popup.html`);

    // Inject Popup HTML
    const htmlInjection = document.createElement("div");
    document.body.appendChild(htmlInjection);
    htmlInjection.outerHTML = await rawHTML.text();

    // Hide launcher
    if (hideLauncher) {
      setLauncherVisible(false);
    }

    // Inject CSS, but only once (e.g. if multiple bots on the page)
    if (!hasCriaStyles) {
      const rawCSS = await fetch(chatConfig.chatApiUrl + "/public/popup/embed.css?cache=" + Math.random().toString());
      const cssInjection = document.createElement("style");
      document.querySelector(`.cria-wrapper[botId='${botId}']`).appendChild(cssInjection);
      cssInjection.id = "cria-styles";
      cssInjection.innerHTML = await rawCSS.text();
    }

    // Set custom Popup colour
    if (chatConfig.embedTheme) {
      const criaLauncher = document.querySelector(`.cria-launcher[botId='${botId}']`);
      criaLauncher.style.borderColor = chatConfig.embedTheme;
    }

    // Inject iframe
    const criaEmbed = document.querySelector(`.cria-embed[botId='${botId}']`);
    const criaEmbedURL = new URL(chatConfig.webAppUrl);

    for (const prop of ["botId", "chatId", "webAppUrl", "chatApiUrl"]) {
      if ((typeof value !== 'function')) {
        criaEmbedURL.searchParams.set(prop, encodeURIComponent(chatConfig[prop]));
      }
    }

    criaEmbed.src = criaEmbedURL.toString();

    // Inject embed image
    const criaEmbedImage = document.querySelector(`.cria-bot-icon[botId='${botId}']`);
    criaEmbedImage.src = chatConfig.botIconUrl;

    if (chatConfig.embedHoverTooltip != null) {
      criaEmbedImage.setAttribute("label", chatConfig.embedHoverTooltip);
      criaEmbedImage.setAttribute("title", chatConfig.embedHoverTooltip);
    }

    // Default enabled status
    setEmbedEnabled(chatConfig.defaultEnabled);

    // Register the switch
    chatConfig.switch = () => setEmbedEnabled(!isEmbedEnabled());

    // Set embed location
    setEmbedPosition(chatConfig.embedPosition || "BL");
    console.info(`Loaded Cria Embed for "${chatConfig.botName}" (${window.CRIA.botId}) bot!`);
  }();

  function isEmbedEnabled() {
    const criaChat = document.querySelector(`.cria-chat[botId='${botId}']`);
    return criaChat.getAttribute("enabled") === "true";
  }

  /**
   * @param {boolean} event.detail
   */
  window.addEventListener(
    "message", (event) => {
      try {
        let data = JSON.parse(event.data) || {};
        if (data.action === "criaSetEmbedEnabled") {
          setEmbedEnabled(data.value);
        }
      } catch (ex) {
      }
    },
    false,
  );

  /**
   * @param {boolean} isEnabled
   */
  function setEmbedEnabled(isEnabled) {
    const criaChat = document.querySelector(`.cria-chat[botId='${botId}']`);
    const criaLauncher = document.querySelector(`.cria-launcher[botId='${botId}']`);
    const criaWrapper = document.querySelector(`.cria-wrapper[botId='${botId}']`);
    const htmlBody = document.body;
    const newState = isEnabled ? "true" : "false";
    criaChat.setAttribute("enabled", newState);
    criaLauncher.setAttribute("enabled", newState);
    criaWrapper.setAttribute("enabled", newState);
    htmlBody.setAttribute('cria-enabled', newState);
  }

  function setLauncherVisible(isVisible) {
    const criaLauncher = document.querySelector(`.cria-launcher[botId='${botId}']`);
    criaLauncher.style.display = isVisible ? "flex" : "none";
  }

  const EMBED_POSITIONS = {
    1: "BL",
    2: "BR",
    3: "TR",
    4: "TL"
  }

  function setEmbedPosition(location) {

    // Check if valid location
    if (!Object.keys(EMBED_POSITIONS).includes(location?.toString())) {
      throw new Error("Invalid embed position!");
    }

    // Set the new location
    const criaWrapper = document.querySelector(`.cria-wrapper[botId='${botId}']`);
    criaWrapper.classList.remove(...Object.values(EMBED_POSITIONS));
    criaWrapper.classList.add(EMBED_POSITIONS[location]);

  }

  class ResizableChat {
    #dragging = false;
    #dragId = undefined;
    #dragInitPos = {x: undefined, y: undefined};
    #overlaySelector = `.cria-chat-overlay[botId='${botId}']`;
    #minWidth = 300;
    #minHeight = 400;
    #maxWidthProportion = 9.5 / 10;
    #maxHeightProportion = 4 / 5;

    #dragIdFuncMap = {
      "cria-chat-n": this.onVerticalUpdate.bind(this),
      "cria-chat-s": this.onVerticalUpdate.bind(this),
      "cria-chat-w": this.onHorizontalUpdate.bind(this),
      "cria-chat-e": this.onHorizontalUpdate.bind(this)
    }

    #dragIdMultiplier = {
      "cria-chat-n": 1,
      "cria-chat-s": -1,
      "cria-chat-e": 1,
      "cria-chat-w": -1
    }

    constructor() {
      document.addEventListener("mousedown", this.onMouseDownEvent.bind(this));
      document.addEventListener("mouseup", this.onMouseUpEvent.bind(this));
      document.addEventListener("mousemove", this.onMouseMoveEvent.bind(this));
    }

    /** Start dragging */
    onMouseDownEvent(event) {
      if (!(Object.keys(this.#dragIdFuncMap).includes(event.target.id))) return;

      this.#dragging = true;
      this.#dragId = event.target.id;
      this.#dragInitPos = {x: event.clientX, y: event.clientY};
      document.querySelector(this.#overlaySelector).style.pointerEvents = "all";
    }

    /** Stop dragging */
    onMouseUpEvent() {
      this.#dragging = false;
      this.#dragId = undefined;
      this.#dragInitPos = {x: undefined, y: undefined};
      document.querySelector(this.#overlaySelector).style.pointerEvents = "none";
    }

    /** On mouse move event */
    onMouseMoveEvent(event) {

      // If not dragging
      if (!this.#dragging) {
        return;
      }

      // If stopped dragging outside of window
      if (event.which === 0) {
        this.#dragging = false;
        return;
      }

      // X,Y coordinates of mouse
      this.#dragIdFuncMap[this.#dragId](event.clientX, event.clientY);

    }

    getMaxWidth() {
      return Math.floor(window.innerWidth * this.#maxWidthProportion);
    }

    getMaxHeight() {
      return Math.floor(window.innerHeight * this.#maxHeightProportion);
    }


    /** Horizontally resize */
    onHorizontalUpdate(clientX, clientY) {
      const changeX = (clientX - this.#dragInitPos.x) * this.#dragIdMultiplier[this.#dragId];
      const criaEmbed = document.querySelector(`.cria-embed[botId='${botId}']`);

      const embedWidth = Math.min(
        Math.max(this.#minWidth, criaEmbed.clientWidth + changeX),
        this.getMaxWidth()
      );

      criaEmbed.style.width = `${embedWidth}px`;
      this.#dragInitPos = {x: clientX, y: clientY};

    }

    /** Vertically resize */
    onVerticalUpdate(clientX, clientY) {
      const changeY = (this.#dragInitPos.y - clientY) * this.#dragIdMultiplier[this.#dragId];
      const criaEmbed = document.querySelector(`.cria-embed[botId='${botId}']`);

      const embedHeight = Math.min(
        Math.max(this.#minHeight, criaEmbed.clientHeight + changeY),
        this.getMaxHeight()
      );

      criaEmbed.style.height = `${embedHeight}px`;
      this.#dragInitPos = {x: clientX, y: clientY};
    }

  }

  window.CRIA["$botId"].setLauncherVisible = setLauncherVisible;
  window.CRIA["$botId"].isEmbedEnabled = isEmbedEnabled;
  window.CRIA["$botId"].setEmbedEnabled = setEmbedEnabled;
  window.CRIA["$botId"].setEmbedLocation = setEmbedPosition;
  window.CRIA["$botId"].resizableChat = new ResizableChat();


}