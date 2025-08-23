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
      let t;
      // Determine current loader script and payload
      const currentScript = document.currentScript;
      let payloadAttr = null;
      try {
        payloadAttr = currentScript?.getAttribute('payload');
      } catch {}
      if (payloadAttr) {
        let sessionData;
        try {
          sessionData = JSON.parse(payloadAttr);
        } catch (e) {
          console.error('Invalid JSON payload for Cria loader:', e);
        }
        if (sessionData) {
          // Build POST url with query params
          const postUrl = new URL(`/embed/${botConfig.botId}/load`, botConfig.chatApiUrl);
          postUrl.searchParams.set('hideLauncher', botConfig.hideLauncher);
          postUrl.searchParams.set('inline', botConfig.inlineLauncher);
          fetch(postUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
          })
          .then(res => res.text())
          .then(jsCode => {
            const s = document.createElement('script');
            s.type = 'text/javascript';
            s.async = true;
            s.text = jsCode;
            document.getElementsByTagName('script')[0].parentNode.appendChild(s);
          })
          .catch(err => console.error('Cria loader POST failed:', err));
          return;
        }
      }
      // Fallback to original GET injection
      t = document.createElement("script");
      t.type = "text/javascript";
      t.async = true;
      if (botConfig.inlineLauncher) {
        t.src = botConfig.chatApiUrl
          + `/embed/${botConfig.botId}/inline.js`
          + `?nocache=${Math.random()}`;
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
