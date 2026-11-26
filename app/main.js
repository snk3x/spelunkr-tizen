// Spelunkr TV loader. Kept to ES5-style code so it runs on any Tizen version.
//
// Why this exists: the TV's video player fails when it seeks deep into an Internet Archive
// video through archive.org's redirect, but plays fine from the direct file address.
// So instead of just opening spelunkr.tv, the app loads the site's page into itself and
// adds a small patch that swaps each archive.org/download link for its direct address.
// If loading fails, it falls back to opening the site directly.
(function () {
  var SITE = "https://spelunkr.tv/";
  var msg = document.getElementById("msg");
  var hint = document.getElementById("hint");

  // Let the page receive the remote's media keys instead of the system.
  var keys = ["MediaPlayPause", "MediaPlay", "MediaPause", "MediaStop",
              "MediaFastForward", "MediaRewind", "ChannelUp", "ChannelDown"];
  if (window.tizen && tizen.tvinputdevice) {
    for (var i = 0; i < keys.length; i++) {
      try { tizen.tvinputdevice.registerKey(keys[i]); } catch (e) { /* key not on this model */ }
    }
  }

  function exitApp() {
    try { tizen.application.getCurrentApplication().exit(); } catch (e) { /* not on a TV */ }
  }

  // Back on this splash screen closes the app.
  document.addEventListener("keydown", function (e) {
    if (e.keyCode === 10009) { exitApp(); }
    if (e.keyCode === 13 && !navigator.onLine) { location.reload(); }
  });

  // ---- Runs inside the loaded Spelunkr page (serialized into it) ----
  function patch(SITE) {
    var SITE_ORIGIN = new URL(SITE).origin;
    var cache = {};

    function needsResolve(u) { return /^https?:\/\/(www\.)?archive\.org\/download\//i.test(u); }

    // Follow archive.org's redirect once and remember the direct file address.
    // A synchronous request keeps the page's own code unchanged: by the time the
    // src setter returns, the element already has the direct address.
    function resolve(u) {
      if (cache[u]) { return cache[u]; }
      var direct = u;
      try {
        var x = new XMLHttpRequest();
        x.open("HEAD", u, false);
        x.send();
        if (x.responseURL) { direct = x.responseURL; }
      } catch (e) { /* keep the original address */ }
      cache[u] = direct;
      return direct;
    }

    function fix(v) {
      var abs = String(v);
      try { abs = new URL(abs, SITE).href; } catch (e) { return v; }
      return needsResolve(abs) ? resolve(abs) : v;
    }

    var proto = HTMLMediaElement.prototype;
    var srcDesc = Object.getOwnPropertyDescriptor(proto, "src");
    Object.defineProperty(proto, "src", {
      configurable: true,
      enumerable: srcDesc.enumerable,
      get: function () { return srcDesc.get.call(this); },
      set: function (v) { srcDesc.set.call(this, fix(v)); }
    });

    // Volume: the site's player starts at 50% and doesn't remember changes. Double every
    // volume it sets (capped at 100%), so its default plays at full volume and its own
    // fades and lower settings still scale proportionally. The site reads back its own value.
    var VOLUME_BOOST = 2;
    var volDesc = Object.getOwnPropertyDescriptor(proto, "volume");
    Object.defineProperty(proto, "volume", {
      configurable: true,
      enumerable: volDesc.enumerable,
      get: function () {
        return this.__siteVolume !== undefined ? this.__siteVolume : volDesc.get.call(this);
      },
      set: function (v) {
        var n = Number(v);
        if (isNaN(n)) { return volDesc.set.call(this, v); } // let the browser throw as usual
        this.__siteVolume = n;
        volDesc.set.call(this, Math.max(0, Math.min(1, n * VOLUME_BOOST)));
      }
    });

    var srcElDesc = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, "src");
    Object.defineProperty(HTMLSourceElement.prototype, "src", {
      configurable: true,
      enumerable: srcElDesc.enumerable,
      get: function () { return srcElDesc.get.call(this); },
      set: function (v) { srcElDesc.set.call(this, fix(v)); }
    });

    var setAttr = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if ((this instanceof HTMLMediaElement || this instanceof HTMLSourceElement) &&
          String(name).toLowerCase() === "src") {
        return setAttr.call(this, name, fix(value));
      }
      return setAttr.apply(this, arguments);
    };

    // The page lives at file:///, but its links point at spelunkr.tv (via <base>).
    // Keep in-app navigation on the local page so the patch stays active.
    ["pushState", "replaceState"].forEach(function (k) {
      var orig = history[k];
      history[k] = function (state, title, url) {
        if (url !== undefined && url !== null) {
          try {
            var p = new URL(url, SITE);
            if (p.origin === SITE_ORIGIN) { url = "file://" + p.pathname + p.search + p.hash; }
          } catch (e) { /* leave it */ }
        }
        return orig.call(history, state, title, url);
      };
    });

    // ---- Remote keys ----
    var KEY_BACK = 10009, KEY_CH_UP = 427, KEY_CH_DOWN = 428;

    function isFullscreen() {
      return !!(document.fullscreenElement || document.webkitFullscreenElement);
    }
    function exitFullscreen() {
      try {
        if (document.exitFullscreen) { document.exitFullscreen(); }
        else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
      } catch (e) { /* ignore */ }
    }

    // Capture phase on window runs before any of the site's own key handlers.
    window.addEventListener("keydown", function (e) {
      // Back while the video is full screen: leave full screen and stop there.
      if (e.keyCode === KEY_BACK && isFullscreen()) {
        e.preventDefault();
        e.stopImmediatePropagation();
        exitFullscreen();
        return;
      }

      // Channel Up/Down: the site listens for key names "ChannelUp"/"ChannelDown",
      // but the TV reports these buttons under other names. Re-send them on the same
      // element. The mapping is swapped on purpose: the site's "ChannelUp" moves the
      // opposite way from what the remote's arrow suggests (confirmed on the TV).
      if ((e.keyCode === KEY_CH_UP || e.keyCode === KEY_CH_DOWN) && !e.__spelunkrTv) {
        var want = e.keyCode === KEY_CH_UP ? "ChannelDown" : "ChannelUp";
        e.preventDefault();
        e.stopImmediatePropagation();
        var ev = new KeyboardEvent("keydown", { key: want, code: want, bubbles: true, cancelable: true });
        ev.__spelunkrTv = true;
        (e.target || document.activeElement || document.body).dispatchEvent(ev);
      }
    }, true);

    // Back on the home screen, when the site didn't use it for anything, closes the app.
    window.addEventListener("keydown", function (e) {
      if (e.keyCode !== KEY_BACK || e.defaultPrevented || isFullscreen()) { return; }
      if (location.pathname === "/" && !document.querySelector("video[src]")) {
        try { tizen.application.getCurrentApplication().exit(); } catch (err) { /* ignore */ }
      }
    });
  }
  // --------------------------------------------------------------------

  function fallback() { location.replace(SITE); }

  function render(html) {
    var inject = '<base href="' + SITE + '">' +
                 '<script>(' + patch.toString() + ')(' + JSON.stringify(SITE) + ');<\/script>';
    var withPatch = html.replace(/<head[^>]*>/i, function (m) { return m + inject; });
    if (withPatch === html) { return fallback(); }
    try { history.replaceState(null, "", "/"); } catch (e) { /* stays at /index.html */ }
    document.open();
    document.write(withPatch);
    document.close();
  }

  function load() {
    if (!navigator.onLine) {
      msg.innerHTML = "No signal. The TV is offline.";
      hint.innerHTML = "Press OK to try again, or Back to exit.";
      return;
    }
    var x = new XMLHttpRequest();
    x.open("GET", SITE, true);
    x.timeout = 15000;
    x.onload = function () {
      if (x.status === 200 && /<html/i.test(x.responseText)) { render(x.responseText); }
      else { fallback(); }
    };
    x.onerror = fallback;
    x.ontimeout = fallback;
    x.send();
  }

  setTimeout(load, 300);
})();
