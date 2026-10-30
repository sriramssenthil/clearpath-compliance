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
  suggestion: z.string().describe("A compliant rewrite or the disclosure to add."),
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
