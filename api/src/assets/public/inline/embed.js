{
  const botId = $botId;

  !async function () {
    window.CRIA ||= {};
    const chatConfig = window.CRIA[botId];

    // Inject iframe
    const criaEmbed = document.createElement("iframe");
    criaEmbed.classList.add("cria-embed");
    criaEmbed.allow = "clipboard-write; microphone; autoplay";
    criaEmbed.setAttribute("botId", "$botId");
    criaEmbed.setAttribute("height", "600");
    criaEmbed.setAttribute("width", "350");

    const criaEmbedURL = new URL(chatConfig.webAppUrl);

    for (const prop of ["botId", "chatId", "webAppUrl", "chatApiUrl"]) {
      if ((typeof value !== 'function')) {
        criaEmbedURL.searchParams.set(prop, encodeURIComponent(chatConfig[prop]));
      }
    }

    criaEmbed.src = criaEmbedURL.toString();

    // Find the anchor element
    const element = document.querySelector("[botAnchorId='$botId']") || document.body;
    element.appendChild(criaEmbed);
    console.info(`Loaded Inline Cria Embed for "${chatConfig.botName}" (${chatConfig.botId}) bot!`);
    document.getElementById("cria-embed-loader")?.remove();
  }();

}