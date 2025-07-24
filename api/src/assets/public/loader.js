/*
This is the Cria loader, built by IT Innovation at York University in 2024.

If you're stalking this script, hello!
*/
!function () {

  let t = window,
    e = document,
    load = function () {
      window.CRIA ||= {};

      const botConfig = $objectReplace;
      window.CRIA[String(botConfig.botId)] = botConfig;
      let t = e.createElement("script");

      t.type = "text/javascript";
      t.async = true;

      if (botConfig.inlineLauncher) {
        t.src = botConfig.chatApiUrl
          + `/embed/${botConfig.botId}/inline.js`
          + `?nocache=${Math.random()}`
      } else {
        t.src = botConfig.chatApiUrl
          + `/embed/${botConfig.botId}/popup.js`
          + `?nocache=${Math.random()}`
          + `&hideLauncher=${botConfig.hideLauncher}`;
      }

      t.id = "cria-embed-loader";
      e.getElementsByTagName("script")[0].parentNode.appendChild(t);
    };

  // Add the script
  if (document.readyState === "complete") {
    load();
  } else {
    if (t["attachEvent"]) t["attachEvent"]("onload", load);
    else t.addEventListener("load", load, undefined);
  }

}();
