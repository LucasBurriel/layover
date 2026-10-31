import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ScenarioSchema, type Scenario } from "../shared/types.ts";

/** Load and validate every scenarios/*.json. Adding a scenario = adding a file. */
export function loadScenarios(dir: string): Map<string, Scenario> {
  const out = new Map<string, Scenario>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const scenario = ScenarioSchema.parse(raw);
    validateReferences(scenario);
    if (out.has(scenario.id)) throw new Error(`duplicate scenario id ${scenario.id} in ${file}`);
    out.set(scenario.id, scenario);
  }
  return out;
}

export function validateReferences(scenario: Scenario): void {
  const npcIds = new Set(scenario.npcs.map((n) => n.id));
  if (npcIds.size !== scenario.npcs.length) throw new Error(`${scenario.id}: duplicate npc id`);
  const objIds = new Set<string>();
  for (const o of scenario.objectives) {
    if (!npcIds.has(o.npcId)) throw new Error(`${scenario.id}: objective ${o.id} points to unknown npc ${o.npcId}`);
    if (objIds.has(o.id)) throw new Error(`${scenario.id}: duplicate objective id ${o.id}`);
    objIds.add(o.id);
  }
}
