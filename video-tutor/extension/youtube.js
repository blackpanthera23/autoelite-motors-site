// Content script for youtube.com: finds the video you're watching and attaches the tutor.
(function attachVideoTutor() {
  "use strict";
  let coach = null;
  let attachedTo = null;
  let attachedId = null;

  function sendToBackground(type, payload) {
    return new Promise(function sendExecutor(resolve, reject) {
      chrome.runtime.sendMessage({ type, payload }, function onReply(reply) {
        if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
        if (!reply || !reply.ok) return reject(new Error(reply ? reply.error : "No response"));
        resolve(reply.data);
      });
    });
  }

  const api = {
    analyze: function analyze(payload) { return sendToBackground("analyze", payload); },
    ask: function ask(payload) { return sendToBackground("ask", payload); },
  };

  function currentVideoId() {
    const url = new URL(location.href);
    const shorts = url.pathname.match(/^\/shorts\/([\w-]{6,})/);
    return shorts ? shorts[1] : url.searchParams.get("v");
  }

  /** The visible, largest <video> (Shorts keeps several in the DOM). */
  function findActiveVideo() {
    let best = null;
    let bestArea = 0;
    for (const video of document.querySelectorAll("video")) {
      const r = video.getBoundingClientRect();
      const visible = r.bottom > 0 && r.top < innerHeight && r.width > 0;
      const area = visible ? r.width * r.height : 0;
      if (area > bestArea) { best = video; bestArea = area; }
    }
    return best;
  }

  /** Extracts the JSON array that follows `"captionTracks":` by bracket matching. */
  function extractCaptionTracks(html) {
    const start = html.indexOf('"captionTracks":');
    if (start < 0) return [];
    let i = html.indexOf("[", start);
    const from = i;
    let depth = 0;
    for (; i < html.length; i++) {
      if (html[i] === "[") depth++;
      else if (html[i] === "]" && --depth === 0) break;
    }
    try { return JSON.parse(html.slice(from, i + 1)); } catch { return []; }
  }

  /** Best effort: YouTube's own captions for this video, as [{t, text}]. Returns [] if unavailable. */
  async function getTranscript() {
    const id = currentVideoId();
    if (!id) return [];
    const html = await (await fetch(`/watch?v=${encodeURIComponent(id)}`, { credentials: "include" })).text();
    const tracks = extractCaptionTracks(html);
    const track = tracks.find(function isEnglish(tr) { return /^en/.test(tr.languageCode); })
      || tracks.find(function isMalay(tr) { return /^(ms|id)/.test(tr.languageCode); })
      || tracks[0];
    if (!track) return [];
    const response = await fetch(`${track.baseUrl}&fmt=json3`, { credentials: "include" });
    const text = await response.text();
    if (!text) return [];
    const data = JSON.parse(text);
    return (data.events || [])
      .filter(function hasText(ev) { return ev.segs; })
      .map(function toLine(ev) {
        return { t: ev.tStartMs / 1000, text: ev.segs.map(function segText(s) { return s.utf8; }).join("").trim() };
      })
      .filter(function nonEmpty(line) { return line.text; });
  }

  function videoTitle() {
    return document.title.replace(/\s*-\s*YouTube$/, "").replace(/^\(\d+\)\s*/, "");
  }

  function mountPanel(panel) {
    document.body.append(panel);
  }

  function syncToPage() {
    const id = currentVideoId();
    const video = id ? findActiveVideo() : null;
    if (video && video === attachedTo && id === attachedId) return;
    if (coach) { coach.destroy(); coach = null; attachedTo = null; attachedId = null; }
    if (!video) return;
    attachedTo = video;
    attachedId = id;
    coach = window.VideoTutor.createCoach({ video, api, title: videoTitle, getTranscript, mount: mountPanel, language: "en" });
  }

  // YouTube is a single-page app: re-check when navigation finishes and when Shorts are swiped.
  document.addEventListener("yt-navigate-finish", function onNavigate() { setTimeout(syncToPage, 500); });
  setInterval(function pollForSwipes() { if (location.pathname.startsWith("/shorts/")) syncToPage(); }, 1500);
  syncToPage();
})();
