import Anthropic from "@anthropic-ai/sdk";
import type { Provider, StreamRequest, StructuredRequest } from "./types.ts";

/** Official Anthropic SDK. Adaptive thinking is the model default; effort controls depth. */
export class AnthropicProvider implements Provider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic(apiKey ? { apiKey } : undefined);
  }

  async *stream(req: StreamRequest): AsyncIterable<string> {
    const stream = this.client.messages.stream({
      model: req.model,
      max_tokens: req.maxTokens,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: req.messages,
      thinking: { type: "adaptive" },
      output_config: { effort: req.effort },
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      throw new Error("The model declined to answer this turn.");
    }
  }

  async structured(req: StructuredRequest): Promise<unknown> {
    const response = await this.client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: req.messages,
      thinking: { type: "adaptive" },
      output_config: {
        effort: req.effort,
        format: { type: "json_schema", schema: req.schema },
      },
    });
    if (response.stop_reason === "refusal") {
      throw new Error("The model declined to answer this turn.");
    }
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return text;
  }
}
