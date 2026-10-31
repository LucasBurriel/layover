import type { Scenario } from "../../shared/types.ts";
import type { RunState } from "../game/scenarioState.ts";

interface Props {
  scenario: Scenario;
  run: RunState;
  onApproach(npcId: string): void;
}

/** The "map": one card per character, connected by a dotted path, in objective order. */
export function SceneMap({ scenario, run, onApproach }: Props) {
  const currentNpc = scenario.objectives[run.currentObjective]?.npcId;
  return (
    <nav className="map" aria-label="characters">
      {scenario.npcs.map((npc, i) => {
        const doneHere = scenario.objectives.filter((o) => o.npcId === npc.id && run.completed.includes(o.id)).length;
        const totalHere = scenario.objectives.filter((o) => o.npcId === npc.id).length;
        const state = run.activeNpcId === npc.id ? "active" : doneHere === totalHere && totalHere > 0 ? "done" : currentNpc === npc.id ? "next" : "idle";
        return (
          <div key={npc.id} className="map-stop">
            {i > 0 && <span className="map-path" aria-hidden />}
            <button className={`npc-card ${state}`} onClick={() => onApproach(npc.id)} disabled={run.finished}>
              <span className="npc-emoji" aria-hidden>{npc.emoji}</span>
              <span className="npc-text">
                <strong>{npc.name}</strong>
                <small>{npc.role}</small>
                <small className="npc-loc">{npc.location}</small>
              </span>
              {state === "done" && <span className="check" aria-label="done">✓</span>}
              {state === "next" && <span className="pulse" aria-label="go here" />}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
