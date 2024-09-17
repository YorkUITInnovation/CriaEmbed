/*
This is the Cria loader, built by IT Innovation at York University in 2024.

If you're stalking this script, hello!
- Isaac
*/
!function () {

  let t = window,
    e = document,
    load = function () {

      window.CRIA = $objectReplace;

      let t = e.createElement("script");

      t.type = "text/javascript";
      t.async = true;
      t.src = window.CRIA.chatApiUrl + "/public/popup/embed.js" + `?nocache=${Math.random()}`;
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
