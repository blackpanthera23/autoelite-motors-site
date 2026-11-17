import { z } from "zod";

/** A box drawn over the video, in 0–1 coordinates of the video frame (top-left origin). */
export const HighlightSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  label: z.string(),
});

export const MomentSchema = z.object({
  t: z.number().describe("Seconds from the start of the video when this moment begins"),
  title: z.string().describe("3-6 word headline"),
  whatsHappening: z.string().describe("Plain-language description of what is on screen / being said"),
  whyItMatters: z.string().describe("The concept a learner should take from this moment"),
  risk: z.string().describe("What could go wrong / the danger here; empty string if none"),
  improve: z.string().describe("What the person in the video (or the learner) could do better; empty string if none"),
  keyMoment: z.boolean().describe("True for the few moments worth pausing on"),
  highlight: HighlightSchema.nullable().describe("Region of the frame to draw attention to, or null"),
  speak: z.string().describe("One or two short sentences to read aloud, conversational"),
});

export const TimelineSchema = z.object({
  topic: z.string(),
  overview: z.string().describe("2-3 sentences: what this video is about"),
  confidenceNote: z.string().describe("What could not be determined from the frames/transcript; empty string if nothing"),
  moments: z.array(MomentSchema),
  summary: z.object({
    whatHappened: z.string(),
    risks: z.array(z.string()),
    improvements: z.array(z.string()),
  }),
  quiz: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.string()),
      answerIndex: z.number().int(),
      explanation: z.string(),
    }),
  ),
});

export type Highlight = z.infer<typeof HighlightSchema>;
export type Moment = z.infer<typeof MomentSchema>;
export type Timeline = z.infer<typeof TimelineSchema>;

export const LanguageSchema = z.enum(["en", "ms"]);
export type Language = z.infer<typeof LanguageSchema>;

const FrameSchema = z.object({
  t: z.number(),
  dataUrl: z.string().startsWith("data:image/"),
});
export type Frame = z.infer<typeof FrameSchema>;

const TranscriptLineSchema = z.object({ t: z.number(), text: z.string() });
export type TranscriptLine = z.infer<typeof TranscriptLineSchema>;

export const AnalyzeRequestSchema = z.object({
  title: z.string().default(""),
  durationSec: z.number().positive(),
  language: LanguageSchema.default("en"),
  frames: z.array(FrameSchema).min(1).max(80),
  transcript: z.array(TranscriptLineSchema).default([]),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export const AskRequestSchema = z.object({
  question: z.string().min(1).max(1000),
  t: z.number(),
  language: LanguageSchema.default("en"),
  frame: FrameSchema.nullable().default(null),
  timeline: TimelineSchema,
  transcript: z.array(TranscriptLineSchema).default([]),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;
