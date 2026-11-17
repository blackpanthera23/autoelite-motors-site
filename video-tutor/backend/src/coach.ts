import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  TimelineSchema,
  type AnalyzeRequest,
  type AskRequest,
  type Frame,
  type Language,
  type Timeline,
  type TranscriptLine,
} from "./schema.js";

const MODEL = "claude-opus-5-5";
const client = new Anthropic();

type ImageBlock = Anthropic.Beta.BetaImageBlockParam;
type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  ms: "Bahasa Melayu (casual, conversational Malaysian Malay)",
};

const COACH_SYSTEM = `You are a patient learning coach who watches a video side by side with a learner.
Your job is to make the video easy to understand for someone new to the topic:
- explain what is happening on screen and what is being said, in plain words
- name the underlying concept at each important moment
- point out risks (what could go wrong) and what could be done better
- be honest: if something cannot be seen in the frames or heard in the transcript, say so instead of guessing
Use concrete details you can actually see (numbers, labels, objects, actions).`;

export class RefusedError extends Error {}

type FrameToImageParams = { frame: Frame };

function frameToImage({ frame }: FrameToImageParams): ImageBlock {
  const match = /^data:(image\/[a-z]+);base64,(.+)$/.exec(frame.dataUrl);
  if (!match) throw new Error("Frame is not a base64 data URL");
  return {
    type: "image",
    source: { type: "base64", media_type: match[1] as ImageMediaType, data: match[2] },
  };
}

type FormatTranscriptParams = { transcript: TranscriptLine[] };

function formatTranscript({ transcript }: FormatTranscriptParams): string {
  if (transcript.length === 0) return "(no transcript available — rely on the frames and on-screen text)";
  return transcript.map(function formatLine(line) {
    return `[${line.t.toFixed(1)}s] ${line.text}`;
  }).join("\n");
}

type AnalyzeVideoParams = { request: AnalyzeRequest };

/** Turns sampled frames + transcript into a timestamped explanation timeline. */
export async function analyzeVideo({ request }: AnalyzeVideoParams): Promise<Timeline> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const frame of request.frames) {
    content.push({ type: "text", text: `Frame at ${frame.t.toFixed(1)}s:` });
    content.push(frameToImage({ frame }));
  }
  content.push({
    type: "text",
    text: `Video title: ${request.title || "(unknown)"}
Duration: ${request.durationSec.toFixed(1)}s
Transcript:
${formatTranscript({ transcript: request.transcript })}

Build the watch-along timeline for this video.
- 4 to 12 moments, in time order, each "t" within 0..${request.durationSec.toFixed(1)}
- mark only the 1-3 most important moments as keyMoment
- highlight boxes use 0-1 coordinates of the frame (x,y = top-left corner); keep them tight around the thing that matters
- summary: what happened overall, the main risks, what to improve
- quiz: 3 multiple-choice questions (3-4 options each) that check the learner understood the key concepts
Write every text field in ${LANGUAGE_NAMES[request.language]}.`,
  });

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: COACH_SYSTEM,
    output_config: { effort: "medium", format: betaZodOutputFormat(TimelineSchema) },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new RefusedError("The model declined to analyze this video.");
  if (!response.parsed_output) throw new Error(`No timeline returned (stop_reason: ${response.stop_reason})`);
  return response.parsed_output;
}

type AnswerQuestionParams = { request: AskRequest };

/** Answers a learner's question about the moment they are currently watching. */
export async function answerQuestion({ request }: AnswerQuestionParams): Promise<string> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (request.frame) {
    content.push({ type: "text", text: `Current frame (${request.t.toFixed(1)}s):` });
    content.push(frameToImage({ frame: request.frame }));
  }
  content.push({
    type: "text",
    text: `Timeline you already built for this video:
${JSON.stringify(request.timeline)}

Transcript:
${formatTranscript({ transcript: request.transcript })}

The learner paused at ${request.t.toFixed(1)}s and asks:
"${request.question}"

Answer in ${LANGUAGE_NAMES[request.language]}, in at most 5 short sentences, like a friend explaining it next to them.`,
  });

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: COACH_SYSTEM,
    output_config: { effort: "low" },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new RefusedError("The model declined to answer this question.");
  return response.content
    .filter(function isText(block): block is Anthropic.Beta.BetaTextBlock {
      return block.type === "text";
    })
    .map(function blockText(block) {
      return block.text;
    })
    .join("\n")
    .trim();
}
