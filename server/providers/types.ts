/**
 * A provider turns prompts into text. Three implementations: the official Anthropic SDK
 * (needs ANTHROPIC_API_KEY), the Claude Agent SDK (uses your Claude Code login, no key),
 * and a mock for UI work and tests.
 */
import type { ProviderName } from "../../shared/types.ts";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamRequest {
  model: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  effort: "low" | "medium" | "high";
}

export interface StructuredRequest extends StreamRequest {
  /** JSON schema the answer must match. */
  schema: Record<string, unknown>;
}

export interface Provider {
  readonly name: ProviderName;
  /** Streams text deltas. The caller concatenates them. */
  stream(req: StreamRequest): AsyncIterable<string>;
  /** Returns either a parsed object or the raw text; the caller runs parseCoachOutput on it. */
  structured(req: StructuredRequest): Promise<unknown>;
}
