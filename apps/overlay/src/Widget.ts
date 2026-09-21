import { nowPlayingOverlayPath, overlayKeyParameter } from "@twitch-integrations/infra/Domain"

/**
 * The Overlay's page, built per response around the nonce its Content
 * Security Policy names, so the inline style and script are the only ones
 * the browser will run. The page holds no data of its own: the script reads
 * the Overlay Key from its own URL and polls the state path with it.
 */

/** How often the widget asks for the state, in milliseconds. */
export const pollIntervalMs = 5000

/** How long each queued track shows before the strip moves to the next, in milliseconds. */
export const rotateIntervalMs = 4000

/** The page's stylesheet, in Catppuccin Macchiato, sized for a 520 by 150 browser source. */
const styles = `
  :root {
    --ctp-crust: #181926;
    --ctp-mantle: #1e2030;
    --ctp-base: #24273a;
    --ctp-surface0: #363a4f;
    --ctp-surface1: #494d64;
    --ctp-subtext0: #a5adcb;
    --ctp-text: #cad3f5;
    --ctp-green: #a6da95;
    --ctp-lavender: #b7bdf8;
    --widget-w: 520px;
    --widget-h: 150px;
    --bg: rgba(36, 39, 58, 0.92);
    --fg: var(--ctp-text);
    --muted: var(--ctp-subtext0);
    --accent: var(--ctp-green);
    --radius: 18px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: transparent; font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif; color: var(--fg); }
  .widget {
    width: var(--widget-w); height: var(--widget-h);
    display: grid; grid-template-columns: var(--widget-h) 1fr;
    background: var(--bg); border-radius: var(--radius); overflow: hidden; position: relative;
    box-shadow: 0 20px 50px rgba(24, 25, 38, .6), inset 0 0 0 1px var(--ctp-surface0);
    opacity: 0; transition: opacity .6s ease;
  }
  .widget.shown { opacity: 1; }
  .art { position: relative; width: 100%; height: 100%; background: var(--ctp-surface0) center / cover no-repeat; }
  .art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(90deg, transparent 70%, var(--bg)); }
  .body { display: grid; grid-template-rows: auto 1fr auto; padding: 16px 196px 14px 18px; min-width: 0; }
  .label { display: flex; align-items: center; gap: 8px; font-size: 10.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
  .bars { display: inline-flex; align-items: flex-end; gap: 2px; height: 12px; }
  .bars i { width: 3px; background: var(--accent); border-radius: 2px; animation: bounce 1s ease-in-out infinite; }
  .bars i:nth-child(2) { animation-delay: .15s; } .bars i:nth-child(3) { animation-delay: .3s; } .bars i:nth-child(4) { animation-delay: .45s; }
  .paused .bars i { animation-play-state: paused; height: 3px; }
  @keyframes bounce { 0%,100% { height: 3px } 50% { height: 12px } }
  .track { min-width: 0; align-self: center; }
  .title { font-size: 21px; font-weight: 700; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .artist { margin-top: 3px; font-size: 14px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .progress { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .progress .bar { height: 4px; border-radius: 2px; background: var(--ctp-surface1); overflow: hidden; }
  .progress .bar > span { display: block; height: 100%; width: 0%; background: var(--accent); border-radius: 2px; transition: width 1s linear; }
  .upnext {
    position: absolute; right: 0; top: 0; bottom: 0; width: 178px; padding: 14px 16px 14px 14px;
    display: grid; grid-template-rows: auto 1fr auto;
    background: linear-gradient(90deg, transparent, rgba(30, 32, 48, .75) 30%); border-left: 1px solid var(--ctp-surface0);
  }
  .upnext .label { color: var(--ctp-lavender); }
  .queue { position: relative; min-width: 0; }
  .queue .item { position: absolute; inset: 0; display: grid; grid-template-columns: 40px 1fr; gap: 10px; align-items: center; opacity: 0; transform: translateY(8px); transition: opacity .45s ease, transform .45s ease; }
  .queue .item.active { opacity: 1; transform: translateY(0); }
  .queue .thumb { width: 40px; height: 40px; border-radius: 8px; background: var(--ctp-surface1) center / cover no-repeat; }
  .queue .meta { min-width: 0; }
  .queue .t { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .queue .a { font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .queue .empty { font-size: 12px; color: var(--muted); align-self: center; }
  .dots { display: flex; gap: 5px; align-items: center; min-height: 5px; }
  .dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--ctp-surface1); transition: background .3s, width .3s; }
  .dots i.active { background: var(--accent); width: 14px; border-radius: 3px; }
`

/**
 * The widget's behaviour: poll the state path with the key from the page's
 * own URL, advance the progress bar between polls, and rotate the up-next
 * strip. Idle while nothing is playing, hidden while the state cannot be
 * read, so a stale card never sits on the stream.
 */
const script = `
  "use strict";
  var POLL_MS = ${pollIntervalMs};
  var ROTATE_MS = ${rotateIntervalMs};
  var key = new URLSearchParams(location.search).get(${JSON.stringify(overlayKeyParameter)}) || "";
  var statePath = ${JSON.stringify(`${nowPlayingOverlayPath}/state`)} + "?" + new URLSearchParams({ ${JSON.stringify(overlayKeyParameter)}: key });
  var widget = document.getElementById("widget");
  var art = document.getElementById("art");
  var title = document.getElementById("title");
  var artist = document.getElementById("artist");
  var elapsedEl = document.getElementById("elapsed");
  var durationEl = document.getElementById("duration");
  var fill = document.getElementById("fill");
  var queue = document.getElementById("queue");
  var dots = document.getElementById("dots");

  var state = null;
  var fetchedAt = 0;
  var queueIndex = 0;

  function fmt(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function artists(track) { return track.artists.join(", "); }
  function setArt(el, url) { el.style.backgroundImage = url ? "url(" + JSON.stringify(url) + ")" : ""; }

  function renderNow() {
    var playback = state && state.playback;
    if (!playback) { widget.classList.remove("shown"); return; }
    widget.classList.add("shown");
    widget.classList.toggle("paused", !playback.isPlaying);
    setArt(art, playback.track.artworkUrl);
    title.textContent = playback.track.name;
    artist.textContent = artists(playback.track);
    durationEl.textContent = fmt(playback.track.durationMs);
    renderProgress();
  }

  function renderProgress() {
    var playback = state && state.playback;
    if (!playback) return;
    var advance = playback.isPlaying ? Date.now() - fetchedAt : 0;
    var progress = Math.min(playback.track.durationMs, playback.progressMs + advance);
    elapsedEl.textContent = fmt(progress);
    fill.style.width = (playback.track.durationMs ? (progress / playback.track.durationMs) * 100 : 0) + "%";
  }

  function renderQueue() {
    var upNext = (state && state.upNext) || [];
    queue.textContent = "";
    dots.textContent = "";
    if (upNext.length === 0) {
      var empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "Queue is empty";
      queue.appendChild(empty);
      return;
    }
    queueIndex = queueIndex % upNext.length;
    upNext.forEach(function (track, i) {
      var item = document.createElement("div");
      item.className = "item" + (i === queueIndex ? " active" : "");
      var thumb = document.createElement("div");
      thumb.className = "thumb";
      setArt(thumb, track.artworkUrl);
      var meta = document.createElement("div");
      meta.className = "meta";
      var t = document.createElement("div");
      t.className = "t";
      t.textContent = (i + 1) + ". " + track.name;
      var a = document.createElement("div");
      a.className = "a";
      a.textContent = artists(track);
      meta.appendChild(t); meta.appendChild(a);
      item.appendChild(thumb); item.appendChild(meta);
      queue.appendChild(item);
      var dot = document.createElement("i");
      if (i === queueIndex) dot.className = "active";
      dots.appendChild(dot);
    });
  }

  function poll() {
    fetch(statePath, { cache: "no-store", credentials: "omit" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (next) {
        var trackChanged = !state || !next || !state.playback || !next.playback || state.playback.track.name !== next.playback.track.name;
        state = next;
        fetchedAt = Date.now();
        if (trackChanged) queueIndex = 0;
        renderNow();
        renderQueue();
      })
      .catch(function () { state = null; renderNow(); });
  }

  poll();
  setInterval(poll, POLL_MS);
  setInterval(renderProgress, 1000);
  setInterval(function () { queueIndex += 1; renderQueue(); }, ROTATE_MS);
`

/** The page around the nonce its Content Security Policy names. */
export const widgetPage = (nonce: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<title>Now Playing</title>
<style nonce="${nonce}">${styles}</style>
</head>
<body>
<div class="widget" id="widget">
  <div class="art" id="art"></div>
  <div class="body">
    <div class="label"><span class="bars"><i></i><i></i><i></i><i></i></span> Now playing</div>
    <div class="track">
      <div class="title" id="title"></div>
      <div class="artist" id="artist"></div>
    </div>
    <div class="progress">
      <span id="elapsed">0:00</span>
      <div class="bar"><span id="fill"></span></div>
      <span id="duration">0:00</span>
    </div>
  </div>
  <aside class="upnext">
    <div class="label">Up next</div>
    <div class="queue" id="queue"></div>
    <div class="dots" id="dots"></div>
  </aside>
</div>
<script nonce="${nonce}">${script}</script>
</body>
</html>
`
