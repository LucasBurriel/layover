import { OBJECTIVE_COMPLETE_TAG } from "../../shared/npcProtocol.ts";
import type { Provider, StreamRequest, StructuredRequest } from "./types.ts";

/**
 * No model. Deterministic, so the UI can be developed and tests can run offline.
 * - NPC: scripted replies; marks the objective complete on the third player turn.
 * - Coach: flags a handful of classic Spanish-speaker errors with simple rules.
 */
export class MockProvider implements Provider {
  readonly name = "mock" as const;
  constructor(private delayMs = 12) {}

  async *stream(req: StreamRequest): AsyncIterable<string> {
    const playerTurns = req.messages.filter((m) => m.role === "user" && !m.content.startsWith("(")).length;
    const last = req.messages.at(-1)?.content ?? "";
    const reply = mockNpcReply(playerTurns, last);
    for (const word of reply.split(/(?<=\s)/)) {
      await sleep(this.delayMs);
      yield word;
    }
  }

  async structured(req: StructuredRequest): Promise<unknown> {
    const quoted = req.messages.at(-1)?.content.match(/replied: "([\s\S]*)"$/);
    const message = quoted?.[1] ?? req.messages.at(-1)?.content ?? "";
    await sleep(this.delayMs * 10);
    return JSON.stringify(mockCoach(message));
  }
}

export function mockNpcReply(playerTurns: number, lastMessage: string): string {
  const scripts = [
    "Right, let me have a look. Could I see your passport, please?",
    "Thank you. One bag to check, is that right? Pop it on the belt for me.",
    `Lovely, that's all done. Here's your boarding pass. Have a good flight.\n${OBJECTIVE_COMPLETE_TAG}`,
  ];
  if (playerTurns <= scripts.length) return scripts[playerTurns - 1]!;
  return `Sorry, I didn't catch that. You said "${lastMessage.slice(0, 40)}"?`;
}

export function mockCoach(message: string) {
  const corrections = [];
  if (/\bi\b(?![A-Za-z'])/.test(message) && /(^|\s)i\s/.test(message)) {
    corrections.push({
      category: "spelling",
      pattern: "capital I",
      original: "i",
      corrected: "I",
      explanation: "The pronoun I is always capitalised in English.",
    });
  }
  const m = message.match(/\bI have (\d+) years\b/i);
  if (m) {
    corrections.push({
      category: "grammar",
      pattern: "age with to be",
      original: m[0],
      corrected: `I am ${m[1]}`,
      explanation: "English uses the verb to be for age, not to have.",
    });
  }
  if (/\bactually\b/i.test(message) && /\bnow\b/i.test(message) === false && /\bcurrently|right now\b/i.test(message) === false && /actually (I|we) (am|are|live|work)/i.test(message)) {
    corrections.push({
      category: "vocabulary",
      pattern: "false friend: actually",
      original: "actually",
      corrected: "currently",
      explanation: "Actually means 'in fact', not 'at the moment' (Spanish actualmente).",
    });
  }
  if (/\bexplain me\b/i.test(message)) {
    corrections.push({
      category: "grammar",
      pattern: "explain to someone",
      original: "explain me",
      corrected: "explain to me",
      explanation: "Explain takes 'to' before the person.",
    });
  }
  const level = corrections.length === 0 ? "B2" : corrections.length === 1 ? "B1" : "A2";
  const nativeVersion = corrections.reduce(
    (acc, c) => acc.replace(new RegExp(`\\b${escapeRegExp(c.original)}\\b`, "i"), c.corrected),
    message,
  );
  return {
    corrections,
    nativeVersion,
    levelEstimate: level,
    praise: corrections.length === 0 ? "Clear and natural, nothing to fix." : "Good, the meaning was perfectly clear.",
  };
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
