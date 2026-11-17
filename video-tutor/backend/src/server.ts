import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { analyzeVideo, answerQuestion, RefusedError } from "./coach.js";
import { mockAnswer, mockTimeline } from "./mock.js";
import { AnalyzeRequestSchema, AskRequestSchema } from "./schema.js";

const PORT = Number(process.env.PORT ?? 8787);
const MOCK = process.env.MOCK === "1";
const MAX_BODY_BYTES = 30 * 1024 * 1024;

const here = path.dirname(fileURLToPath(import.meta.url));
const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: path.join(here, "../web/index.html"), type: "text/html; charset=utf-8" },
  "/coach-ui.js": { file: path.join(here, "../../extension/coach-ui.js"), type: "text/javascript; charset=utf-8" },
  "/coach.css": { file: path.join(here, "../../extension/coach.css"), type: "text/css; charset=utf-8" },
};

type SendJsonParams = { res: http.ServerResponse; status: number; body: unknown };

function sendJson({ res, status, body }: SendJsonParams): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

type ReadBodyParams = { req: http.IncomingMessage };

async function readJsonBody({ req }: ReadBodyParams): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body too large");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

type HandleParams = { req: http.IncomingMessage; res: http.ServerResponse };

async function handleAnalyze({ req, res }: HandleParams): Promise<void> {
  const request = AnalyzeRequestSchema.parse(await readJsonBody({ req }));
  console.log(`analyze: "${request.title}" ${request.durationSec.toFixed(0)}s, ${request.frames.length} frames, ${request.transcript.length} transcript lines`);
  const timeline = MOCK ? mockTimeline({ request }) : await analyzeVideo({ request });
  sendJson({ res, status: 200, body: { timeline, mock: MOCK } });
}

async function handleAsk({ req, res }: HandleParams): Promise<void> {
  const request = AskRequestSchema.parse(await readJsonBody({ req }));
  const answer = MOCK ? mockAnswer({ request }) : await answerQuestion({ request });
  sendJson({ res, status: 200, body: { answer } });
}

async function handleStatic({ req, res }: HandleParams): Promise<boolean> {
  const entry = STATIC_FILES[new URL(req.url ?? "/", "http://x").pathname];
  if (!entry || req.method !== "GET") return false;
  res.writeHead(200, { "content-type": entry.type });
  res.end(await readFile(entry.file));
  return true;
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    if (req.method === "POST" && req.url === "/api/analyze") return await handleAnalyze({ req, res });
    if (req.method === "POST" && req.url === "/api/ask") return await handleAsk({ req, res });
    if (await handleStatic({ req, res })) return;
    sendJson({ res, status: 404, body: { error: "Not found" } });
  } catch (error) {
    if (error instanceof ZodError) return sendJson({ res, status: 400, body: { error: "Invalid request", issues: error.issues } });
    if (error instanceof RefusedError) return sendJson({ res, status: 422, body: { error: error.message } });
    console.error(error);
    sendJson({ res, status: 500, body: { error: error instanceof Error ? error.message : "Server error" } });
  }
}

http.createServer(handleRequest).listen(PORT, "127.0.0.1", function onListening() {
  console.log(`Video Tutor backend on http://localhost:${PORT}${MOCK ? " (MOCK mode — demo data, no API calls)" : ""}`);
});
