import { CoachOutputSchema, type CoachOutput } from "./types.ts";

/**
 * Parse the coach's output. With the Anthropic SDK we get a structured output already
 * parsed; with other providers (Claude Code login, mock) we get text that should be JSON,
 * sometimes wrapped in a ```json fence or preceded by chatter. Be forgiving about the
 * wrapping and strict about the final shape.
 */
export function parseCoachOutput(input: unknown): CoachOutput {
  if (typeof input !== "string") {
    return CoachOutputSchema.parse(input);
  }
  const text = input.trim();
  const candidates: string[] = [];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) candidates.push(fence[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  candidates.push(text);
  let lastError: unknown;
  for (const c of candidates) {
    try {
      return CoachOutputSchema.parse(JSON.parse(c));
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`coach output is not valid JSON matching the schema: ${String(lastError)}`);
}

/** JSON schema for providers that take one (Agent SDK outputFormat). A test keeps it in sync with CoachOutputSchema. */
export const COACH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["corrections", "nativeVersion", "levelEstimate", "praise"],
  properties: {
    corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "pattern", "original", "corrected", "explanation"],
        properties: {
          category: { type: "string", enum: ["grammar", "vocabulary", "naturalness", "spelling", "register"] },
          pattern: { type: "string" },
          original: { type: "string" },
          corrected: { type: "string" },
          explanation: { type: "string" },
        },
      },
    },
    nativeVersion: { type: "string" },
    levelEstimate: { type: "string", enum: ["A2", "B1", "B2", "C1"] },
    praise: { type: "string" },
  },
} as const;
