!async function () {
  window.CRIA ||= {};

  // Load resources
  const [rawCSS, rawHTML] = [
    await fetch(window.CRIA.chatApiUrl + "/public/popup/embed.css?cache=" + Math.random().toString()),
    await fetch(window.CRIA.chatApiUrl + "/public/popup/embed.html")
  ];

  // Inject HTML
  const htmlInjection = document.createElement("div");
  document.body.appendChild(htmlInjection);
  htmlInjection.outerHTML = await rawHTML.text();

  // Inject CSS
  const cssInjection = document.createElement("style");
  document.getElementById("cria-wrapper").appendChild(cssInjection);
  cssInjection.id = "cria-styles";
  cssInjection.innerHTML = await rawCSS.text();

  // Inject custom colour
  if (window.CRIA.embedTheme) {
    cssInjection.innerHTML += `\n#cria-launcher{border-color: ${window.CRIA.embedTheme} !important;}\n`;
  }

  // Inject iframe
  const criaEmbed = document.getElementById("cria-embed");
  const criaEmbedURL = new URL(window.CRIA.webAppUrl);

  for (const prop of ["botId", "chatId", "webAppUrl", "chatApiUrl"]) {
    if ((typeof value !== 'function')) {
      criaEmbedURL.searchParams.set(prop, encodeURIComponent(window.CRIA[prop]));
    }
  }

  criaEmbed.src = criaEmbedURL.toString();

  // Inject embed image
  const criaEmbedImage = document.getElementById("cria-bot-icon");
  criaEmbedImage.src = window.CRIA.botIconUrl;

  if (window.CRIA.embedHoverTooltip != null) {
    criaEmbedImage.setAttribute("label", window.CRIA.embedHoverTooltip);
    criaEmbedImage.setAttribute("title", window.CRIA.embedHoverTooltip);
  }

  // Default enabled status
  setEmbedEnabled(window.CRIA.defaultEnabled);

  // Register the switch
  window.CRIA.switch = () => setEmbedEnabled(!isEmbedEnabled());

  // Set embed location
  setEmbedPosition(window.CRIA.embedPosition || "BL");
  console.info(`Loaded Cria Embed for "${window.CRIA.botName}" (${window.CRIA.botId}) bot!`);
}();

function isEmbedEnabled() {
  const criaChat = document.getElementById("cria-chat");
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
  const criaChat = document.getElementById("cria-chat");
  const criaLauncher = document.getElementById("cria-launcher");
  const criaWrapper = document.getElementById("cria-wrapper");
  const htmlBody = document.body;
  const newState = isEnabled ? "true" : "false";
  criaChat.setAttribute("enabled", newState);
  criaLauncher.setAttribute("enabled", newState);
  criaWrapper.setAttribute("enabled", newState);
  htmlBody.setAttribute('cria-enabled', newState);
}

function setLauncherVisible(isVisible) {
  const criaLauncher = document.getElementById("cria-launcher");
  criaLauncher.style.display = isVisible ? "block" : "none";
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
  const criaWrapper = document.getElementById("cria-wrapper");
  criaWrapper.classList.remove(...Object.values(EMBED_POSITIONS));
  criaWrapper.classList.add(EMBED_POSITIONS[location]);

}

class ResizableChat {
  #dragging = false;
  #dragId = undefined;
  #dragInitPos = {x: undefined, y: undefined};
  #overlayId = "cria-chat-overlay";
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
    document.getElementById(this.#overlayId).style.pointerEvents = "all";
  }

  /** Stop dragging */
  onMouseUpEvent() {
    this.#dragging = false;
    this.#dragId = undefined;
    this.#dragInitPos = {x: undefined, y: undefined};
    document.getElementById(this.#overlayId).style.pointerEvents = "none";
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
    const criaEmbed = document.getElementById("cria-embed");

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
    const criaEmbed = document.getElementById("cria-embed");

    const embedHeight = Math.min(
      Math.max(this.#minHeight, criaEmbed.clientHeight + changeY),
      this.getMaxHeight()
    );

    criaEmbed.style.height = `${embedHeight}px`;
    this.#dragInitPos = {x: clientX, y: clientY};
  }

}

window.CRIA.setLauncherVisible = setLauncherVisible;
window.CRIA.isEmbedEnabled = isEmbedEnabled;
window.CRIA.setEmbedEnabled = setEmbedEnabled;
window.CRIA.setEmbedLocation = setEmbedPosition;
window.CRIA.resizableChat = new ResizableChat();

