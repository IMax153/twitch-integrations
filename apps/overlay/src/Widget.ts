import { nowPlayingOverlayPath, overlayKeyParameter } from "@twitch-integrations/infra/Domain"

/**
 * The Overlay's page, built per response around the nonce its Content
 * Security Policy names, so the inline style and script are the only ones
 * the browser will run. The page holds no data of its own: the script reads
 * the Overlay Key from its own URL and polls the state path with it.
 */

/** How often the widget asks for the state, in milliseconds. */
export const pollIntervalMs = 5000

/** How long the playing track holds the card before the queue takes it, in milliseconds. */
export const nowPlayingHoldMs = 8000

/** How long each queued track holds the card before the next, in milliseconds. */
export const upNextHoldMs = 4000

/** The width the card is drawn at, matching the chat beside it. */
export const widgetWidth = 340

/** The height the card is drawn at. */
export const widgetHeight = 110

/**
 * The page's stylesheet, in Catppuccin Macchiato, sized for a 340 by 110
 * browser source. The card is solid: nothing behind it shows through, so it
 * reads the same over any scene.
 */
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
    --widget-w: ${widgetWidth}px;
    --widget-h: ${widgetHeight}px;
    --bg: var(--ctp-base);
    --fg: var(--ctp-text);
    --muted: var(--ctp-subtext0);
    --accent: var(--ctp-green);
    --radius: 16px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: transparent; font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif; color: var(--fg); }
  .widget {
    width: var(--widget-w); height: var(--widget-h);
    display: grid; grid-template-columns: var(--widget-h) 1fr;
    background: var(--bg); border-radius: var(--radius); overflow: hidden; position: relative;
    box-shadow: inset 0 0 0 1px var(--ctp-surface0);
    visibility: hidden;
  }
  .widget.shown { visibility: visible; }
  .art { width: 100%; height: 100%; background: var(--ctp-surface0) center / cover no-repeat; }
  .body { display: grid; grid-template-rows: auto 1fr auto; padding: 12px 14px 12px 14px; min-width: 0; }
  .label { display: flex; align-items: center; gap: 8px; font-size: 10.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent); }
  .label .position { margin-left: auto; letter-spacing: .06em; color: var(--muted); }
  .bars { display: inline-flex; align-items: flex-end; gap: 2px; height: 12px; }
  .bars i { width: 3px; background: var(--accent); border-radius: 2px; animation: bounce 1s ease-in-out infinite; }
  .bars i:nth-child(2) { animation-delay: .15s; } .bars i:nth-child(3) { animation-delay: .3s; } .bars i:nth-child(4) { animation-delay: .45s; }
  .paused .bars i { animation-play-state: paused; height: 3px; }
  @keyframes bounce { 0%,100% { height: 3px } 50% { height: 12px } }
  .track { min-width: 0; align-self: center; }
  .title { font-size: 16px; font-weight: 700; line-height: 1.15; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow-wrap: anywhere; }
  .artist { margin-top: 3px; font-size: 12.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .progress { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; font-size: 10.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .progress .bar { height: 4px; border-radius: 2px; background: var(--ctp-surface1); overflow: hidden; }
  .progress .bar > span { display: block; height: 100%; width: 0%; background: var(--accent); border-radius: 2px; transition: width 1s linear; }
  .dots { display: flex; gap: 5px; align-items: center; height: 14px; }
  .dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--ctp-surface1); transition: background .3s, width .3s; }
  .dots i.active { background: var(--accent); width: 14px; border-radius: 3px; }
  .upnext .label { color: var(--ctp-lavender); }
  .upnext .bars { display: none; }
  .upnext .progress { display: none; }
  .upnext .dots i.active { background: var(--ctp-lavender); }
  .now .dots { display: none; }
  .now .progress { display: grid; }
  .body > * { transition: opacity .35s ease; }
  .switching .body > *, .switching .art { opacity: 0; transition: none; }
`

/**
 * The widget's behaviour: poll the state path with the key from the page's
 * own URL, advance the progress bar between polls, and cycle the one card
 * through the playing track and then each queued track in turn, back to
 * the playing track. Idle while nothing is playing, hidden while the state
 * cannot be read, so a stale card never sits on the stream.
 */
const script = `
  "use strict";
  var POLL_MS = ${pollIntervalMs};
  var NOW_HOLD_MS = ${nowPlayingHoldMs};
  var UP_NEXT_HOLD_MS = ${upNextHoldMs};
  var key = new URLSearchParams(location.search).get(${JSON.stringify(overlayKeyParameter)}) || "";
  var statePath = ${JSON.stringify(`${nowPlayingOverlayPath}/state`)} + "?" + new URLSearchParams({ ${JSON.stringify(overlayKeyParameter)}: key });
  var widget = document.getElementById("widget");
  var art = document.getElementById("art");
  var label = document.getElementById("label");
  var position = document.getElementById("position");
  var title = document.getElementById("title");
  var artist = document.getElementById("artist");
  var elapsedEl = document.getElementById("elapsed");
  var durationEl = document.getElementById("duration");
  var fill = document.getElementById("fill");
  var dots = document.getElementById("dots");

  var state = null;
  var fetchedAt = 0;
  // Which card shows: 0 is the playing track, n is the nth queued track.
  var slide = 0;
  var rotation = null;

  function fmt(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function artists(track) { return track.artists.join(", "); }
  function setArt(el, url) { el.style.backgroundImage = url ? "url(" + JSON.stringify(url) + ")" : ""; }
  function upNext() { return (state && state.upNext) || []; }

  function renderProgress() {
    var playback = state && state.playback;
    if (!playback) return;
    var advance = playback.isPlaying ? Date.now() - fetchedAt : 0;
    var progress = Math.min(playback.track.durationMs, playback.progressMs + advance);
    elapsedEl.textContent = fmt(progress);
    durationEl.textContent = fmt(playback.track.durationMs);
    fill.style.width = (playback.track.durationMs ? (progress / playback.track.durationMs) * 100 : 0) + "%";
  }

  function renderDots() {
    var queued = upNext();
    dots.textContent = "";
    for (var i = 0; i <= queued.length; i++) {
      var dot = document.createElement("i");
      if (i === slide) dot.className = "active";
      dots.appendChild(dot);
    }
  }

  function render() {
    var playback = state && state.playback;
    if (!playback) { widget.classList.remove("shown"); return; }
    var queued = upNext();
    if (slide > queued.length) slide = 0;
    var onNow = slide === 0;
    var track = onNow ? playback.track : queued[slide - 1];
    widget.classList.add("shown");
    widget.classList.toggle("now", onNow);
    widget.classList.toggle("upnext", !onNow);
    widget.classList.toggle("paused", !playback.isPlaying);
    setArt(art, track.artworkUrl);
    label.textContent = onNow ? "Now playing" : "Up next";
    position.textContent = onNow ? "" : slide + " of " + queued.length;
    title.textContent = track.name;
    artist.textContent = artists(track);
    renderProgress();
    renderDots();
  }

  // Blank the card for a frame between slides so the text does not visibly reflow.
  function showSlide(next) {
    slide = next;
    widget.classList.add("switching");
    render();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { widget.classList.remove("switching"); });
    });
  }

  function scheduleRotation() {
    clearTimeout(rotation);
    rotation = setTimeout(function () {
      var queued = upNext();
      if (queued.length === 0) { showSlide(0); scheduleRotation(); return; }
      showSlide(slide >= queued.length ? 0 : slide + 1);
      scheduleRotation();
    }, slide === 0 ? NOW_HOLD_MS : UP_NEXT_HOLD_MS);
  }

  function poll() {
    fetch(statePath, { cache: "no-store", credentials: "omit" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (next) {
        var trackChanged = !state || !next || !state.playback || !next.playback || state.playback.track.name !== next.playback.track.name;
        state = next;
        fetchedAt = Date.now();
        if (trackChanged) { showSlide(0); scheduleRotation(); } else { render(); }
      })
      .catch(function () { state = null; render(); });
  }

  poll();
  setInterval(poll, POLL_MS);
  setInterval(renderProgress, 1000);
  scheduleRotation();
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
<div class="widget now" id="widget">
  <div class="art" id="art"></div>
  <div class="body">
    <div class="label"><span class="bars"><i></i><i></i><i></i><i></i></span> <span id="label">Now playing</span><span class="position" id="position"></span></div>
    <div class="track">
      <div class="title" id="title"></div>
      <div class="artist" id="artist"></div>
    </div>
    <div class="progress">
      <span id="elapsed">0:00</span>
      <div class="bar"><span id="fill"></span></div>
      <span id="duration">0:00</span>
    </div>
    <div class="dots" id="dots"></div>
  </div>
</div>
<script nonce="${nonce}">${script}</script>
</body>
</html>
`
