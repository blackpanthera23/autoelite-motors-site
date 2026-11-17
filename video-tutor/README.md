# Video Tutor (v0.1)

Watches a video with you and explains it: what's happening, why it matters, the risks, and what to improve. It also draws highlight boxes on the video, can read explanations aloud, pauses on key moments, answers questions about the current moment, and ends with a summary and a quiz. English or Bahasa Melayu.

## How it works

1. **Capture** happens in your browser. It samples about 60 frames (512px JPEG) from the video you're watching. On YouTube it also tries to fetch the captions, and falls back to frames only if there are none.
2. **Analyze:** the backend sends the frames and transcript to Claude (`claude-opus-5-5`) and gets back a structured timeline (Zod-validated JSON): moments with timestamps, explanations, risks, improvements, highlight boxes, a summary and a quiz.
3. **Play along:** `coach-ui.js` syncs the timeline to playback. It shows the explanation card, draws the highlight box, speaks with the browser's built-in text-to-speech, and auto-pauses on key moments.
4. **Ask:** your question, the current frame and the timeline go to Claude, and the answer is shown and spoken.

Videos are never downloaded server-side. Capture happens in the browser you're already watching in.

## Run it

```bash
cd backend
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # or: ant auth login
npm run dev                          # http://localhost:8787
npm run mock                         # demo mode: canned poker walkthrough, no API key needed
```

- **Any video file:** open http://localhost:8787, pick a file, then click "Explain this video".
- **YouTube:** in `chrome://extensions`, turn on Developer mode, click "Load unpacked" and select the `extension/` folder. Open any video or Short; the Video Tutor panel appears on the right.

## Cost (rough)

A 1-minute video at 60 frames × ~200 tokens (landscape) to ~620 tokens (vertical Short) is about 12k–37k input tokens. That's around US$0.10–0.25 per analysis on Opus 5.5, including output. Each question costs a fraction of a cent.

## Files

| Path | What it does |
|---|---|
| `backend/src/server.ts` | HTTP server: `POST /api/analyze`, `POST /api/ask`, plus the upload page |
| `backend/src/coach.ts` | Claude calls (structured timeline + Q&A), with server-side refusal fallback enabled |
| `backend/src/schema.ts` | Zod schemas for requests and the timeline |
| `backend/src/mock.ts` | Offline demo data (`MOCK=1`) |
| `extension/coach-ui.js` | Shared watch-along UI: frame sampling, panel, highlight, voice, quiz |
| `extension/youtube.js` | Finds the active YouTube video or Short, fetches captions, mounts the UI |
| `extension/background.js` | Relays extension requests to `localhost:8787` |

## Known limits / next steps

- Frame sampling seeks through the video, so there's a few seconds of "watching" before playback. Fine for Shorts; long videos get sparser frames (60 max).
- The YouTube caption fetch is best-effort. If YouTube changes its page, it falls back to frames only.
- Next: speech-to-text for videos without captions, chunking for long videos, real-time "live" mode, and saving what you learned.
