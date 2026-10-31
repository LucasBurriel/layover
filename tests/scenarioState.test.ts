import { describe, expect, it } from "vitest";
import type { Scenario } from "../shared/types.ts";
import { activeObjective, progress, reduceRun, startRun, type RunState } from "../src/game/scenarioState.ts";

const scenario: Scenario = {
  id: "t",
  title: "T",
  emoji: "x",
  tagline: "",
  setting: "",
  playerRole: "",
  npcs: [
    { id: "a", name: "A", role: "r", emoji: "", personality: "", knowledge: [], location: "", greeting: "Hello" },
    { id: "b", name: "B", role: "r", emoji: "", personality: "", knowledge: [], location: "" },
  ],
  objectives: [
    { id: "o1", npcId: "a", title: "", hint: "", successCriteria: "" },
    { id: "o2", npcId: "a", title: "", hint: "", successCriteria: "" },
    { id: "o3", npcId: "b", title: "", hint: "", successCriteria: "" },
  ],
};

const now = new Date("2026-01-01T00:00:00Z");

describe("startRun", () => {
  it("starts at the first objective, in front of its NPC, with greetings in place", () => {
    const s = startRun(scenario, now);
    expect(s.currentObjective).toBe(0);
    expect(s.activeNpcId).toBe("a");
    expect(s.conversations.a?.turns).toEqual([{ role: "npc", text: "Hello" }]);
    expect(s.conversations.b?.turns).toEqual([]);
    expect(s.startedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(s.finished).toBe(false);
  });
});

describe("reduceRun", () => {
  function exchange(s: RunState, npcId: string, text: string, reply: string, complete: boolean, objectiveId = activeObjective(scenario, s)!.id) {
    s = reduceRun(scenario, s, { type: "player-says", npcId, text });
    for (const piece of reply.split(" ")) s = reduceRun(scenario, s, { type: "npc-delta", npcId, text: piece + " " });
    return reduceRun(scenario, s, { type: "npc-done", npcId, reply, objectiveComplete: complete, objectiveId });
  }

  it("records the player turn, accumulates deltas, then commits the reply", () => {
    let s = startRun(scenario, now);
    s = reduceRun(scenario, s, { type: "player-says", npcId: "a", text: "hi" });
    expect(s.conversations.a?.pending).toBe("");
    s = reduceRun(scenario, s, { type: "npc-delta", npcId: "a", text: "Wel" });
    s = reduceRun(scenario, s, { type: "npc-delta", npcId: "a", text: "come" });
    expect(s.conversations.a?.pending).toBe("Welcome");
    s = reduceRun(scenario, s, { type: "npc-done", npcId: "a", reply: "Welcome", objectiveComplete: false, objectiveId: "o1" });
    expect(s.conversations.a?.pending).toBeUndefined();
    expect(s.conversations.a?.turns.at(-1)).toEqual({ role: "npc", text: "Welcome" });
    expect(s.currentObjective).toBe(0);
  });

  it("advances objectives and moves the player to the next NPC when it changes", () => {
    let s = startRun(scenario, now);
    s = exchange(s, "a", "one", "ok", true);
    expect(s.completed).toEqual(["o1"]);
    expect(s.currentObjective).toBe(1);
    expect(s.activeNpcId).toBe("a"); // o2 is also with A
    s = exchange(s, "a", "two", "ok", true);
    expect(s.currentObjective).toBe(2);
    expect(s.activeNpcId).toBe("b");
    expect(s.finished).toBe(false);
    s = exchange(s, "b", "three", "bye", true);
    expect(s.finished).toBe(true);
    expect(progress(scenario, s)).toEqual({ done: 3, total: 3 });
  });

  it("ignores a completion signal from an NPC that does not own the current objective", () => {
    let s = startRun(scenario, now);
    s = reduceRun(scenario, s, { type: "approach", npcId: "b" });
    s = exchange(s, "b", "hi", "hi", true, "o1");
    expect(s.completed).toEqual([]);
    expect(s.currentObjective).toBe(0);
  });

  it("ignores a stale completion for an objective id that is not current", () => {
    let s = startRun(scenario, now);
    s = exchange(s, "a", "one", "ok", true);
    s = exchange(s, "a", "again", "ok", true, "o1");
    expect(s.completed).toEqual(["o1"]);
    expect(s.currentObjective).toBe(1);
  });

  it("turns an error into a visible NPC line and keeps the run going", () => {
    let s = startRun(scenario, now);
    s = reduceRun(scenario, s, { type: "player-says", npcId: "a", text: "hi" });
    s = reduceRun(scenario, s, { type: "npc-error", npcId: "a", message: "server 502" });
    expect(s.conversations.a?.turns.at(-1)?.text).toContain("502");
    expect(s.finished).toBe(false);
  });
});
