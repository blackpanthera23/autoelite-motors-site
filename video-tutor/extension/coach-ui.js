/*
 * Video Tutor — shared watch-along UI.
 * Used by the Chrome extension (on YouTube) and by the backend's upload page.
 * All model text is inserted with textContent (never innerHTML): it is untrusted,
 * and YouTube enforces Trusted Types anyway.
 */
(function defineVideoTutor(global) {
  "use strict";

  const UI_TEXT = {
    en: {
      analyze: "🎓 Explain this video",
      sampling: "Watching… capturing frames",
      thinking: "Thinking about what happened…",
      ready: "Ready — press play",
      risk: "Risk",
      improve: "Improve",
      why: "Why it matters",
      voice: "Voice",
      autoPause: "Pause on key moments",
      ask: "Ask about this moment…",
      askBtn: "Ask",
      continue: "Continue ▶",
      summary: "Summary & quiz",
      whatHappened: "What happened",
      risks: "Risks",
      improvements: "What to improve",
      quiz: "Quick quiz",
      correct: "Correct!",
      wrong: "Not quite.",
      timeline: "Timeline",
      noTranscript: "No transcript found — explaining from the frames only.",
    },
    ms: {
      analyze: "🎓 Terangkan video ni",
      sampling: "Tengah tonton… ambil frame",
      thinking: "Tengah fikir apa yang jadi…",
      ready: "Dah siap — tekan play",
      risk: "Risiko",
      improve: "Boleh baiki",
      why: "Kenapa penting",
      voice: "Suara",
      autoPause: "Pause masa penting",
      ask: "Tanya pasal saat ni…",
      askBtn: "Tanya",
      continue: "Sambung ▶",
      summary: "Ringkasan & kuiz",
      whatHappened: "Apa yang jadi",
      risks: "Risiko",
      improvements: "Apa nak baiki",
      quiz: "Kuiz ringkas",
      correct: "Betul!",
      wrong: "Belum tepat.",
      timeline: "Garis masa",
      noTranscript: "Tiada transkrip — terang guna frame sahaja.",
    },
  };

  /** Small DOM builder. Children may be strings (rendered as text) or nodes. */
  function el(tag, props, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props || {})) {
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    for (const child of children || []) {
      if (child == null || child === false) continue;
      node.append(typeof child === "string" ? document.createTextNode(child) : child);
    }
    return node;
  }

  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function waitForEvent(target, eventName, timeoutMs) {
    return new Promise(function waitExecutor(resolve) {
      const timer = setTimeout(finish, timeoutMs);
      function finish() {
        clearTimeout(timer);
        target.removeEventListener(eventName, finish);
        resolve();
      }
      target.addEventListener(eventName, finish);
    });
  }

  function grabFrame(video, width) {
    const scale = width / video.videoWidth;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.72);
  }

  /** Seeks through the video and captures evenly spaced frames, then restores playback position. */
  async function sampleFrames({ video, maxFrames = 60, width = 512, onProgress }) {
    if (!video.duration || !isFinite(video.duration)) await waitForEvent(video, "loadedmetadata", 5000);
    const duration = video.duration;
    const interval = Math.max(1, duration / maxFrames);
    const restoreTime = video.currentTime;
    const wasMuted = video.muted;
    video.pause();
    video.muted = true;
    const frames = [];
    try {
      for (let t = 0.2; t < duration; t += interval) {
        video.currentTime = t;
        await waitForEvent(video, "seeked", 4000);
        frames.push({ t: Math.round(t * 10) / 10, dataUrl: grabFrame(video, width) });
        if (onProgress) onProgress(frames.length, Math.ceil(duration / interval));
      }
    } finally {
      video.currentTime = restoreTime;
      video.muted = wasMuted;
    }
    return { duration, frames };
  }

  /** Where the picture actually sits inside the <video> box (accounts for letterboxing). */
  function videoContentRect(video) {
    const box = video.getBoundingClientRect();
    if (!video.videoWidth) return box;
    const scale = Math.min(box.width / video.videoWidth, box.height / video.videoHeight);
    const w = video.videoWidth * scale;
    const h = video.videoHeight * scale;
    return { left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2, width: w, height: h };
  }

  function speak(text, language) {
    if (!global.speechSynthesis || !text) return;
    global.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === "ms" ? "ms-MY" : "en-US";
    utterance.rate = 1.05;
    global.speechSynthesis.speak(utterance);
  }

  /**
   * Builds the panel + highlight overlay and drives the watch-along.
   * api: { analyze(payload) -> {timeline}, ask(payload) -> {answer} }
   * getTranscript: async () -> [{t, text}]
   */
  function createCoach({ video, api, title, getTranscript, mount, language: initialLanguage }) {
    let language = initialLanguage || "en";
    let timeline = null;
    let transcript = [];
    let activeIndex = -1;
    let summaryShown = false;
    let voiceOn = true;
    let autoPause = true;
    const pausedFor = new Set();

    const status = el("div", { class: "vt-status" });
    const momentBox = el("div", { class: "vt-moment" });
    const timelineList = el("ol", { class: "vt-timeline" });
    const summaryBox = el("div", { class: "vt-summary", hidden: "" });
    const answerBox = el("div", { class: "vt-answer", hidden: "" });
    const askInput = el("input", { class: "vt-ask-input", type: "text" });
    const analyzeBtn = el("button", { class: "vt-primary", onclick: runAnalysis });
    const langSelect = el("select", { class: "vt-lang", onchange: onLanguageChange }, [
      el("option", { value: "en", text: "English" }),
      el("option", { value: "ms", text: "Bahasa Melayu" }),
    ]);
    langSelect.value = language;
    const voiceToggle = el("input", { type: "checkbox", checked: "", onchange: function onVoice(e) { voiceOn = e.target.checked; if (!voiceOn) global.speechSynthesis?.cancel(); } });
    const pauseToggle = el("input", { type: "checkbox", checked: "", onchange: function onPause(e) { autoPause = e.target.checked; } });
    const voiceLabel = el("span");
    const pauseLabel = el("span");
    const askBtn = el("button", { class: "vt-secondary", onclick: askQuestion });
    const summaryBtn = el("button", { class: "vt-link", onclick: function onSummaryClick() { showSummary(true); }, hidden: "" });

    // Keep YouTube's keyboard shortcuts (k, j, l, f, m…) from firing while typing.
    askInput.addEventListener("keydown", function onAskKey(e) {
      e.stopPropagation();
      if (e.key === "Enter") askQuestion();
    });

    const panel = el("aside", { class: "vt-panel" }, [
      el("header", { class: "vt-header" }, [el("strong", { text: "Video Tutor" }), langSelect]),
      analyzeBtn,
      status,
      momentBox,
      el("div", { class: "vt-toggles" }, [
        el("label", {}, [voiceToggle, voiceLabel]),
        el("label", {}, [pauseToggle, pauseLabel]),
      ]),
      el("div", { class: "vt-ask" }, [askInput, askBtn]),
      answerBox,
      timelineList,
      summaryBtn,
      summaryBox,
    ]);

    const highlight = el("div", { class: "vt-highlight", hidden: "" }, [el("span", { class: "vt-highlight-label" })]);
    const continueBtn = el("button", { class: "vt-continue", hidden: "", onclick: function onContinue() { continueBtn.hidden = true; video.play(); } });
    document.body.append(highlight, continueBtn);
    mount(panel);

    function t(key) {
      return UI_TEXT[language][key];
    }

    function applyUiText() {
      analyzeBtn.textContent = t("analyze");
      voiceLabel.textContent = ` ${t("voice")}`;
      pauseLabel.textContent = ` ${t("autoPause")}`;
      askInput.placeholder = t("ask");
      askBtn.textContent = t("askBtn");
      continueBtn.textContent = t("continue");
      summaryBtn.textContent = t("summary");
    }

    function setStatus(text) {
      status.textContent = text || "";
    }

    function onLanguageChange() {
      language = langSelect.value;
      applyUiText();
    }

    async function runAnalysis() {
      analyzeBtn.disabled = true;
      summaryShown = false;
      pausedFor.clear();
      try {
        setStatus(t("sampling"));
        const [{ duration, frames }, lines] = await Promise.all([
          sampleFrames({
            video,
            onProgress: function onFrameProgress(done, total) { setStatus(`${t("sampling")} ${done}/${total}`); },
          }),
          getTranscript ? getTranscript().catch(function noTranscript() { return []; }) : Promise.resolve([]),
        ]);
        transcript = lines;
        setStatus(t("thinking"));
        const result = await api.analyze({ title: title(), durationSec: duration, language, frames, transcript });
        timeline = result.timeline;
        renderTimeline();
        summaryBtn.hidden = false;
        const notes = [t("ready")];
        if (transcript.length === 0) notes.push(t("noTranscript"));
        if (timeline.confidenceNote) notes.push(timeline.confidenceNote);
        if (result.mock) notes.push("(demo data — MOCK mode)");
        setStatus(notes.join(" · "));
        renderMoment(null);
      } catch (error) {
        setStatus(`⚠️ ${error.message || error}`);
      } finally {
        analyzeBtn.disabled = false;
      }
    }

    function renderTimeline() {
      timelineList.replaceChildren(el("li", { class: "vt-timeline-head", text: t("timeline") }));
      timeline.moments.forEach(function addTimelineItem(moment, index) {
        timelineList.append(
          el("li", { "data-index": String(index), class: moment.keyMoment ? "vt-key" : "" }, [
            el("button", {
              class: "vt-jump",
              onclick: function onJump() { video.currentTime = moment.t; video.play(); },
            }, [el("span", { class: "vt-time", text: formatTime(moment.t) }), ` ${moment.title}`]),
          ]),
        );
      });
    }

    function renderMoment(moment) {
      if (!moment) {
        momentBox.replaceChildren(el("p", { class: "vt-overview", text: timeline ? timeline.overview : "" }));
        return;
      }
      momentBox.replaceChildren(
        el("h3", {}, [el("span", { class: "vt-time", text: formatTime(moment.t) }), ` ${moment.title}`]),
        el("p", { text: moment.whatsHappening }),
        el("p", {}, [el("b", { text: `${t("why")}: ` }), moment.whyItMatters]),
        moment.risk ? el("p", { class: "vt-risk" }, [el("b", { text: `⚠️ ${t("risk")}: ` }), moment.risk]) : null,
        moment.improve ? el("p", { class: "vt-improve" }, [el("b", { text: `💡 ${t("improve")}: ` }), moment.improve]) : null,
      );
      for (const item of timelineList.querySelectorAll("li[data-index]")) {
        item.classList.toggle("vt-active", Number(item.dataset.index) === activeIndex);
      }
    }

    function positionHighlight() {
      const moment = timeline && timeline.moments[activeIndex];
      const box = moment && moment.highlight;
      const visible = box && video.currentTime - moment.t < 5;
      highlight.hidden = !visible;
      if (!visible) return;
      const rect = videoContentRect(video);
      Object.assign(highlight.style, {
        left: `${rect.left + box.x * rect.width + global.scrollX}px`,
        top: `${rect.top + box.y * rect.height + global.scrollY}px`,
        width: `${box.w * rect.width}px`,
        height: `${box.h * rect.height}px`,
      });
      highlight.firstChild.textContent = box.label;
    }

    function positionContinue() {
      const rect = video.getBoundingClientRect();
      Object.assign(continueBtn.style, {
        left: `${rect.left + rect.width / 2 + global.scrollX}px`,
        top: `${rect.top + rect.height - 70 + global.scrollY}px`,
      });
    }

    function onTimeUpdate() {
      if (!timeline) return;
      const now = video.currentTime;
      let index = -1;
      timeline.moments.forEach(function findActive(moment, i) {
        if (moment.t <= now + 0.15) index = i;
      });
      if (index !== activeIndex) {
        activeIndex = index;
        const moment = timeline.moments[index];
        renderMoment(moment || null);
        if (moment && !video.paused) {
          if (voiceOn) speak(moment.speak, language);
          // Only pause when playback reaches the moment, not when the user seeks far past it.
          const justReached = now - moment.t < 1.5;
          if (autoPause && moment.keyMoment && justReached && !pausedFor.has(index)) {
            pausedFor.add(index);
            video.pause();
            positionContinue();
            continueBtn.hidden = false;
          }
        }
      }
      positionHighlight();
      // Shorts loop forever and never fire "ended", so detect the end ourselves.
      if (!summaryShown && video.duration && now > video.duration - 0.6) showSummary(false);
    }

    function showSummary(scrollIntoView) {
      if (!timeline) return;
      summaryShown = true;
      const s = timeline.summary;
      summaryBox.replaceChildren(
        el("h3", { text: t("whatHappened") }),
        el("p", { text: s.whatHappened }),
        el("h4", { text: `⚠️ ${t("risks")}` }),
        el("ul", {}, s.risks.map(function riskItem(r) { return el("li", { text: r }); })),
        el("h4", { text: `💡 ${t("improvements")}` }),
        el("ul", {}, s.improvements.map(function improveItem(r) { return el("li", { text: r }); })),
        el("h4", { text: `📝 ${t("quiz")}` }),
        ...timeline.quiz.map(renderQuizQuestion),
      );
      summaryBox.hidden = false;
      if (scrollIntoView) summaryBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function renderQuizQuestion(q, qIndex) {
      const feedback = el("p", { class: "vt-feedback" });
      const options = q.options.map(function renderOption(option, i) {
        return el("button", {
          class: "vt-option",
          onclick: function onPick(e) {
            const right = i === q.answerIndex;
            e.currentTarget.classList.add(right ? "vt-right" : "vt-wrong");
            feedback.textContent = `${right ? t("correct") : t("wrong")} ${q.explanation}`;
          },
        }, [option]);
      });
      return el("div", { class: "vt-quiz" }, [el("p", { text: `${qIndex + 1}. ${q.question}` }), ...options, feedback]);
    }

    async function askQuestion() {
      const question = askInput.value.trim();
      if (!question || !timeline) return;
      video.pause();
      askBtn.disabled = true;
      answerBox.hidden = false;
      answerBox.textContent = "…";
      try {
        const frame = video.videoWidth ? { t: video.currentTime, dataUrl: grabFrame(video, 640) } : null;
        const { answer } = await api.ask({ question, t: video.currentTime, language, frame, timeline, transcript });
        answerBox.textContent = answer;
        if (voiceOn) speak(answer, language);
        askInput.value = "";
      } catch (error) {
        answerBox.textContent = `⚠️ ${error.message || error}`;
      } finally {
        askBtn.disabled = false;
      }
    }

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("seeked", onTimeUpdate);
    video.addEventListener("play", function onPlay() { continueBtn.hidden = true; });
    global.addEventListener("resize", positionHighlight);
    global.addEventListener("scroll", positionHighlight, { passive: true });
    applyUiText();

    return {
      destroy: function destroyCoach() {
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("seeked", onTimeUpdate);
        global.speechSynthesis?.cancel();
        panel.remove();
        highlight.remove();
        continueBtn.remove();
      },
    };
  }

  global.VideoTutor = { createCoach, sampleFrames };
})(window);
