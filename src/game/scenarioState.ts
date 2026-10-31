/**
 * State of one scenario run: which objective is active, per-NPC conversations, and whether
 * the run is over. A pure reducer so it is trivially testable and independent of React.
 */
import type { ChatTurn, Scenario } from "../../shared/types.ts";

export interface Conversation {
  turns: ChatTurn[];
  /** The NPC turn currently streaming in, if any. */
  pending?: string;
}

export interface RunState {
  scenarioId: string;
  startedAt: string;
  currentObjective: number;
  completed: string[];
  conversations: Record<string, Conversation>;
  /** Which NPC the player is standing in front of. */
  activeNpcId: string;
  finished: boolean;
}

export type RunAction =
  | { type: "approach"; npcId: string }
  | { type: "player-says"; npcId: string; text: string }
  | { type: "npc-delta"; npcId: string; text: string }
  | { type: "npc-done"; npcId: string; reply: string; objectiveComplete: boolean; objectiveId: string }
  | { type: "npc-error"; npcId: string; message: string };

export function startRun(scenario: Scenario, now: Date = new Date()): RunState {
  const first = scenario.objectives[0]!;
  const conversations: Record<string, Conversation> = {};
  for (const npc of scenario.npcs) {
    conversations[npc.id] = { turns: npc.greeting ? [{ role: "npc", text: npc.greeting }] : [] };
  }
  return {
    scenarioId: scenario.id,
    startedAt: now.toISOString(),
    currentObjective: 0,
    completed: [],
    conversations,
    activeNpcId: first.npcId,
    finished: false,
  };
}

export function activeObjective(scenario: Scenario, state: RunState) {
  return scenario.objectives[state.currentObjective];
}

export function reduceRun(scenario: Scenario, state: RunState, action: RunAction): RunState {
  switch (action.type) {
    case "approach":
      return { ...state, activeNpcId: action.npcId };
    case "player-says": {
      const conv = state.conversations[action.npcId] ?? { turns: [] };
      return withConversation(state, action.npcId, {
        turns: [...conv.turns, { role: "player", text: action.text }],
        pending: "",
      });
    }
    case "npc-delta": {
      const conv = state.conversations[action.npcId] ?? { turns: [] };
      return withConversation(state, action.npcId, { ...conv, pending: (conv.pending ?? "") + action.text });
    }
    case "npc-done": {
      const conv = state.conversations[action.npcId] ?? { turns: [] };
      let next = withConversation(state, action.npcId, {
        turns: action.reply ? [...conv.turns, { role: "npc", text: action.reply }] : conv.turns,
      });
      const objective = activeObjective(scenario, state);
      const isCurrent = objective && objective.id === action.objectiveId && objective.npcId === action.npcId;
      if (action.objectiveComplete && isCurrent && !state.completed.includes(objective.id)) {
        const completed = [...state.completed, objective.id];
        const idx = state.currentObjective + 1;
        const finished = idx >= scenario.objectives.length;
        const nextObjective = scenario.objectives[idx];
        next = {
          ...next,
          completed,
          currentObjective: finished ? state.currentObjective : idx,
          finished,
          // Move the player to the next NPC automatically when they are different.
          activeNpcId: nextObjective ? nextObjective.npcId : state.activeNpcId,
        };
      }
      return next;
    }
    case "npc-error": {
      const conv = state.conversations[action.npcId] ?? { turns: [] };
      return withConversation(state, action.npcId, {
        turns: [...conv.turns, { role: "npc", text: `(…${action.message})` }],
      });
    }
  }
}

function withConversation(state: RunState, npcId: string, conv: Conversation): RunState {
  return { ...state, conversations: { ...state.conversations, [npcId]: conv } };
}

export function progress(scenario: Scenario, state: RunState): { done: number; total: number } {
  return { done: state.completed.length, total: scenario.objectives.length };
}
