import { z } from "zod";

/**
 * Structured output requested from the model. There is deliberately no field that can
 * approve, clear, waive or re-score anything: the model can only ADD flags.
 */
export const AiFindingSchema = z.object({
  rule_code: z.string().describe("Exactly one of the rule codes listed in the system prompt."),
  severity: z.enum(["high", "medium", "low"]),
  quote: z
    .string()
    .describe("Text copied verbatim, character for character, from the submission."),
  issue: z.string().describe("What is wrong, in one or two plain sentences."),
  suggestion: z.string().describe("Guidance for the marketer: what to change and why, in one or two sentences."),
  replacement: z
    .string()
    .nullable()
    .describe("Exact compliant ad copy that can replace the quoted text word for word, or null if the fix is an addition or needs the marketer's judgement. Never an instruction."),
  insert_text: z
    .string()
    .nullable()
    .describe("Complete ad copy to add (for example an approved disclosure, verbatim), or null. Never an instruction."),
  confidence: z.enum(["low", "medium", "high"]),
});

export const AiAnalysisSchema = z.object({
  extracted_text: z
    .string()
    .nullable()
    .describe("Faithful transcription of an attached image or PDF, including small print; null for text-only submissions."),
  summary: z.string().describe("Two or three sentences describing what the asset says and the main concerns."),
  findings: z.array(AiFindingSchema),
});

export type AiFinding = z.infer<typeof AiFindingSchema>;
export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;
