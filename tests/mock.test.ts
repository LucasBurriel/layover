import { describe, expect, it } from "vitest";
import { parseCoachOutput } from "../shared/coachProtocol.ts";
import { parseNpcReply } from "../shared/npcProtocol.ts";
import { MockProvider, mockCoach } from "../server/providers/mock.ts";
import { renderTranscript } from "../server/providers/claudeCode.ts";
import { resolveProviderName } from "../server/providers/index.ts";

describe("mock provider", () => {
  it("streams a scripted reply and completes the objective on the third player turn", async () => {
    const p = new MockProvider(0);
    const messages = [
      { role: "user" as const, content: "(The player walks up to you.)" },
      { role: "assistant" as const, content: "Hi" },
      { role: "user" as const, content: "one" },
      { role: "assistant" as const, content: "..." },
      { role: "user" as const, content: "two" },
      { role: "assistant" as const, content: "..." },
      { role: "user" as const, content: "three" },
    ];
    let out = "";
    for await (const d of p.stream({ model: "m", system: "", messages, maxTokens: 1, effort: "low" })) out += d;
    expect(parseNpcReply(out).objectiveComplete).toBe(true);
  });

  it("the coach output parses and flags classic errors with word boundaries", () => {
    const c = mockCoach("Hi, i have 30 years");
    expect(parseCoachOutput(JSON.stringify(c)).corrections.map((x) => x.pattern)).toEqual(["capital I", "age with to be"]);
    expect(c.nativeVersion).toBe("Hi, I am 30");
  });

  it("the coach leaves a clean message alone", () => {
    expect(mockCoach("A window seat, please.").corrections).toEqual([]);
  });
});

describe("renderTranscript", () => {
  it("passes a single user message through untouched", () => {
    expect(renderTranscript([{ role: "user", content: "hi" }])).toBe("hi");
  });
  it("labels turns and ends with an open NPC turn", () => {
    expect(renderTranscript([{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }, { role: "user", content: "bye" }])).toBe(
      "Player: hi\nYou: hello\nPlayer: bye\nYou:",
    );
  });
});

describe("resolveProviderName", () => {
  it("prefers the mock flag, then LLM_PROVIDER, then the key, then the Claude Code login", () => {
    expect(resolveProviderName({ ANTHROPIC_API_KEY: "k" }, true)).toBe("mock");
    expect(resolveProviderName({ ANTHROPIC_API_KEY: "k", LLM_PROVIDER: "claude-code" }, false)).toBe("claude-code");
    expect(resolveProviderName({ ANTHROPIC_API_KEY: "k" }, false)).toBe("anthropic");
    expect(resolveProviderName({}, false)).toBe("claude-code");
  });
});
