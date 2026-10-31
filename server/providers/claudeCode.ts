import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import type { ChatMessage, Provider, StreamRequest, StructuredRequest } from "./types.ts";

/**
 * Claude Agent SDK used as a plain model call: no tools, one turn, no project settings.
 * It authenticates with the local Claude Code login, so the game runs without an API key.
 * The conversation history is rendered into the prompt because each query() is a fresh
 * one-turn session.
 */
export class ClaudeCodeProvider implements Provider {
  readonly name = "claude-code" as const;

  private baseOptions(req: StreamRequest): Options {
    return {
      model: req.model,
      systemPrompt: req.system,
      tools: [],
      allowedTools: [],
      maxTurns: 1,
      settingSources: [],
      effort: req.effort,
      persistSession: false,
    } as Options;
  }

  async *stream(req: StreamRequest): AsyncIterable<string> {
    const q = query({
      prompt: renderTranscript(req.messages),
      options: { ...this.baseOptions(req), includePartialMessages: true },
    });
    for await (const msg of q) {
      if (msg.type === "stream_event") {
        const ev = msg.event;
        if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          yield ev.delta.text;
        }
      } else if (msg.type === "result" && msg.subtype !== "success") {
        throw new Error(`claude-code provider failed: ${msg.subtype}`);
      }
    }
  }

  async structured(req: StructuredRequest): Promise<unknown> {
    const q = query({
      prompt: renderTranscript(req.messages),
      options: {
        ...this.baseOptions(req),
        outputFormat: { type: "json_schema", schema: req.schema },
      },
    });
    let text = "";
    for await (const msg of q) {
      if (msg.type === "result") {
        if (msg.subtype !== "success") throw new Error(`claude-code provider failed: ${msg.subtype}`);
        if (msg.structured_output !== undefined) return msg.structured_output;
        text = msg.result;
      }
    }
    return text;
  }
}

/**
 * The Agent SDK takes one prompt string per turn, so prior turns are rendered as a
 * transcript. The system prompt already says who speaks; the labels make it unambiguous.
 */
export function renderTranscript(messages: ChatMessage[]): string {
  if (messages.length === 1 && messages[0]?.role === "user") return messages[0].content;
  const lines = messages.map((m) => `${m.role === "user" ? "Player" : "You"}: ${m.content}`);
  lines.push("You:");
  return lines.join("\n");
}
