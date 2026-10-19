{
  const botId = $botIdLiteral;
  const hideLauncher = $hideLauncher;

  !(async function () {
    window.CRIA ||= {};
    const chatConfig = window.CRIA[botId];

    const hasCriaStyles = !!document.getElementById("cria-styles");
    const rawHTML = await fetch(
      chatConfig.chatApiUrl + `/embed/${botId}/popup.html`
    );

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
      const rawCSS = await fetch(
        chatConfig.chatApiUrl +
          "/public/popup/embed.css?cache=" +
          Math.random().toString()
      );
      const cssInjection = document.createElement("style");
      document
        .querySelector(`.cria-wrapper[botId='${botId}']`)
        .appendChild(cssInjection);
      cssInjection.id = "cria-styles";
      cssInjection.innerHTML = await rawCSS.text();
    }

    // Set custom Popup colour
    if (chatConfig.embedTheme) {
      const criaLauncher = document.querySelector(
        `.cria-launcher[botId='${botId}']`
      );
      criaLauncher.style.borderColor = chatConfig.embedTheme;
    }

    // Inject iframe
    const criaEmbed = document.querySelector(`.cria-embed[botId='${botId}']`);
    const criaEmbedURL = new URL(chatConfig.webAppUrl);

    for (const prop of [
      "botId",
      "chatId",
      "webAppUrl",
      "chatApiUrl",
      "devKey"
    ]) {
      if (typeof chatConfig[prop] !== "function" && chatConfig[prop] != null) {
        criaEmbedURL.searchParams.set(prop, String(chatConfig[prop]));
      }
    }

    criaEmbed.src = criaEmbedURL.toString();
    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    window.visualViewport?.addEventListener("scroll", updateViewport);

    // Inject embed image
    const criaEmbedImage = document.querySelector(
      `.cria-bot-icon[botId='${botId}']`
    );
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
    console.info(
      `Loaded Cria Embed for "${chatConfig.botName}" (${chatConfig.botId}) bot!`
    );
    document.getElementById("cria-embed-loader")?.remove();
  })();

  function isEmbedEnabled() {
    const criaChat = document.querySelector(`.cria-chat[botId='${botId}']`);
    return criaChat.getAttribute("enabled") === "true";
  }

  /**
   * @param {boolean} event.detail
   */
  window.addEventListener(
    "message",
    event => {
      const iframe = document.querySelector(`.cria-embed[botId='${botId}']`);
      if (
        !iframe ||
        event.source !== iframe.contentWindow ||
        event.origin !== new URL(iframe.src).origin
      ) {
        return;
      }
      let data;
      try {
        data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (
        data?.action === "criaSetEmbedEnabled" &&
        typeof data.value === "boolean"
      ) {
        setEmbedEnabled(data.value);
      }
    },
    false
  );

  /**
   * @param {boolean} isEnabled
   */
  function setEmbedEnabled(isEnabled) {
    const criaChat = document.querySelector(`.cria-chat[botId='${botId}']`);
    const criaLauncher = document.querySelector(
      `.cria-launcher[botId='${botId}']`
    );
    const criaWrapper = document.querySelector(
      `.cria-wrapper[botId='${botId}']`
    );
    const htmlBody = document.body;
    const newState = isEnabled ? "true" : "false";
    criaChat.setAttribute("enabled", newState);
    criaLauncher.setAttribute("enabled", newState);
    criaLauncher.setAttribute("aria-expanded", newState);
    criaWrapper.setAttribute("enabled", newState);
    htmlBody.setAttribute(
      "cria-enabled",
      String(!!document.querySelector('.cria-wrapper[enabled="true"]'))
    );
  }

  function updateViewport() {
    const wrapper = document.querySelector(`.cria-wrapper[botId='${botId}']`);
    const viewport = window.visualViewport;
    wrapper.style.setProperty(
      "--cria-viewport-height",
      `${viewport?.height ?? window.innerHeight}px`
    );
    wrapper.style.setProperty(
      "--cria-viewport-width",
      `${viewport?.width ?? window.innerWidth}px`
    );
    wrapper.style.setProperty(
      "--cria-viewport-top",
      `${viewport?.offsetTop ?? 0}px`
    );
    wrapper.style.setProperty(
      "--cria-viewport-left",
      `${viewport?.offsetLeft ?? 0}px`
    );
  }

  function setLauncherVisible(isVisible) {
    const criaLauncher = document.querySelector(
      `.cria-launcher[botId='${botId}']`
    );
    criaLauncher.style.display = isVisible ? "flex" : "none";
  }

  const EMBED_POSITIONS = {
    1: "BL",
    2: "BR",
    3: "TR",
    4: "TL"
  };

  function setEmbedPosition(location) {
    const raw = location == null ? "" : String(location).trim();
    const normalized = raw.toUpperCase();
    const position =
      EMBED_POSITIONS[raw] || EMBED_POSITIONS[normalized] || normalized;

    // Check if valid location
    if (!Object.values(EMBED_POSITIONS).includes(position)) {
      throw new Error("Invalid embed position!");
    }

    // Set the new location
    const criaWrapper = document.querySelector(
      `.cria-wrapper[botId='${botId}']`
    );
    criaWrapper.classList.remove(...Object.values(EMBED_POSITIONS));
    criaWrapper.classList.add(position);
  }

  class ResizableChat {
    #dragging = false;
    #dragId = undefined;
    #dragInitPos = { x: undefined, y: undefined };
    #pointerId;
    #handle;
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
    };

    #dragIdMultiplier = {
      "cria-chat-n": 1,
      "cria-chat-s": -1,
      "cria-chat-e": 1,
      "cria-chat-w": -1
    };

    constructor() {
      document.addEventListener(
        "pointerdown",
        this.onMouseDownEvent.bind(this)
      );
      document.addEventListener("pointerup", this.onMouseUpEvent.bind(this));
      document.addEventListener(
        "pointercancel",
        this.onMouseUpEvent.bind(this)
      );
      document.addEventListener(
        "lostpointercapture",
        this.onMouseUpEvent.bind(this)
      );
      document.addEventListener(
        "pointermove",
        this.onMouseMoveEvent.bind(this)
      );
      window.addEventListener("blur", () => this.onMouseUpEvent());
    }

    isResizableHandle(target) {
      const isValidHandle = Object.keys(this.#dragIdFuncMap).some(selector =>
        target.classList.contains(selector)
      );

      const isCorrectBotId = target.getAttribute("botId") === String(botId);
      return isValidHandle && isCorrectBotId;
    }

    /** Start dragging */
    onMouseDownEvent(event) {
      if (
        !this.isResizableHandle(event.target) ||
        event.button !== 0 ||
        window.matchMedia("(max-width: 600px), (max-height: 480px)").matches
      ) {
        return;
      }

      event.preventDefault();
      this.#pointerId = event.pointerId;
      this.#handle = event.target;
      this.#handle.setPointerCapture(event.pointerId);
      // Ensure the selected element has a class matching one of the resizable handlers and the current botId
      this.#dragging = true;
      this.#dragId = event.target.className; // Use the class name instead of id
      this.#dragInitPos = { x: event.clientX, y: event.clientY };
      document.querySelector(this.#overlaySelector).style.pointerEvents = "all";
    }

    /** Stop dragging */
    onMouseUpEvent(event) {
      if (event && event.pointerId !== this.#pointerId) return;
      const handle = this.#handle;
      const pointerId = this.#pointerId;
      this.#dragging = false;
      this.#handle = undefined;
      this.#pointerId = undefined;
      this.#dragId = undefined;
      this.#dragInitPos = { x: undefined, y: undefined };
      document.querySelector(this.#overlaySelector).style.pointerEvents =
        "none";
      if (handle?.hasPointerCapture(pointerId)) {
        handle.releasePointerCapture(pointerId);
      }
    }

    /** On mouse move event */
    onMouseMoveEvent(event) {
      // If not dragging
      if (!this.#dragging || event.pointerId !== this.#pointerId) {
        return;
      }

      // If stopped dragging outside of window
      if (event.buttons === 0) {
        this.onMouseUpEvent(event);
        return;
      }

      // X,Y coordinates of mouse
      this.#dragIdFuncMap[this.#dragId](event.clientX, event.clientY);
    }

    getMaxWidth() {
      return Math.max(
        0,
        Math.min(
          Math.floor(window.innerWidth * this.#maxWidthProportion),
          window.innerWidth - 46
        )
      );
    }

    getMaxHeight() {
      return Math.max(
        0,
        Math.min(
          Math.floor(window.innerHeight * this.#maxHeightProportion),
          window.innerHeight - 128
        )
      );
    }

    /** Horizontally resize */
    onHorizontalUpdate(clientX, clientY) {
      const changeX =
        (clientX - this.#dragInitPos.x) * this.#dragIdMultiplier[this.#dragId];
      const criaEmbed = document.querySelector(`.cria-embed[botId='${botId}']`);

      const embedWidth = Math.min(
        Math.max(this.#minWidth, criaEmbed.clientWidth + changeX),
        this.getMaxWidth()
      );

      criaEmbed.style.width = `${embedWidth}px`;
      this.#dragInitPos = { x: clientX, y: clientY };
    }

    /** Vertically resize */
    onVerticalUpdate(clientX, clientY) {
      const changeY =
        (this.#dragInitPos.y - clientY) * this.#dragIdMultiplier[this.#dragId];
      const criaEmbed = document.querySelector(`.cria-embed[botId='${botId}']`);

      const embedHeight = Math.min(
        Math.max(this.#minHeight, criaEmbed.clientHeight + changeY),
        this.getMaxHeight()
      );

      criaEmbed.style.height = `${embedHeight}px`;
      this.#dragInitPos = { x: clientX, y: clientY };
    }
  }

  window.CRIA[botId].setLauncherVisible = setLauncherVisible;
  window.CRIA[botId].isEmbedEnabled = isEmbedEnabled;
  window.CRIA[botId].setEmbedEnabled = setEmbedEnabled;
  window.CRIA[botId].setEmbedLocation = setEmbedPosition;
  window.CRIA[botId].resizableChat = new ResizableChat();
}
