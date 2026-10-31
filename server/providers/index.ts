import type { ProviderName } from "../../shared/types.ts";
import { AnthropicProvider } from "./anthropic.ts";
import { ClaudeCodeProvider } from "./claudeCode.ts";
import { MockProvider } from "./mock.ts";
import type { Provider } from "./types.ts";

export type { Provider } from "./types.ts";

/**
 * auto: ANTHROPIC_API_KEY set -> official SDK; otherwise the Claude Code login.
 * The key never leaves this process.
 */
export function resolveProviderName(env: NodeJS.ProcessEnv, mockFlag: boolean): ProviderName {
  if (mockFlag) return "mock";
  const explicit = env.LLM_PROVIDER?.trim();
  if (explicit === "anthropic" || explicit === "claude-code" || explicit === "mock") return explicit;
  return env.ANTHROPIC_API_KEY ? "anthropic" : "claude-code";
}

export function createProvider(name: ProviderName): Provider {
  switch (name) {
    case "anthropic":
      return new AnthropicProvider();
    case "claude-code":
      return new ClaudeCodeProvider();
    case "mock":
      return new MockProvider();
  }
}
