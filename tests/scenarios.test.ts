import { describe, expect, it } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadScenarios, validateReferences } from "../server/scenarios.ts";
import { npcSystemPrompt, coachSystemPrompt } from "../server/prompts.ts";
import { OBJECTIVE_COMPLETE_TAG } from "../shared/npcProtocol.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "scenarios");

describe("scenario files", () => {
  const scenarios = loadScenarios(dir);

  it("all load and validate", () => {
    expect(scenarios.size).toBeGreaterThanOrEqual(1);
    expect(scenarios.has("airport")).toBe(true);
  });

  it("the airport has at least three NPCs, each with an objective", () => {
    const airport = scenarios.get("airport")!;
    expect(airport.npcs.length).toBeGreaterThanOrEqual(3);
    const withObjective = new Set(airport.objectives.map((o) => o.npcId));
    for (const npc of airport.npcs) expect(withObjective.has(npc.id)).toBe(true);
  });

  it("rejects an objective pointing at an unknown NPC", () => {
    const airport = scenarios.get("airport")!;
    const broken = { ...airport, objectives: [{ ...airport.objectives[0]!, npcId: "ghost" }] };
    expect(() => validateReferences(broken)).toThrow(/unknown npc/);
  });
});

describe("prompts", () => {
  const airport = loadScenarios(dir).get("airport")!;
  const npc = airport.npcs[0]!;
  const objective = airport.objectives[0]!;

  it("the NPC prompt carries knowledge, goal, level guidance and the completion tag", () => {
    const p = npcSystemPrompt(airport, npc, objective, {
      scenarioId: "airport",
      npcId: npc.id,
      objectiveId: objective.id,
      history: [{ role: "player", text: "hi" }],
      playerLevel: "A2",
      weakPatterns: ["articles"],
    });
    for (const k of npc.knowledge) expect(p).toContain(k);
    expect(p).toContain(objective.successCriteria);
    expect(p).toContain(OBJECTIVE_COMPLETE_TAG);
    expect(p).toContain("Player level: A2");
    expect(p).toContain('"articles"');
    expect(p).toMatch(/Speak only English/);
  });

  it("the NPC prompt omits the weak-pattern paragraph when there is nothing to push", () => {
    const p = npcSystemPrompt(airport, npc, objective, {
      scenarioId: "airport",
      npcId: npc.id,
      objectiveId: objective.id,
      history: [{ role: "player", text: "hi" }],
      playerLevel: "B2",
      weakPatterns: [],
    });
    expect(p).not.toContain("tends to get these wrong");
  });

  it("the coach prompt names the NPC and the learner level", () => {
    const p = coachSystemPrompt(airport, npc, { scenarioId: "airport", npcId: npc.id, playerMessage: "x", playerLevel: "B1" });
    expect(p).toContain(npc.name);
    expect(p).toContain("B1");
  });
});
