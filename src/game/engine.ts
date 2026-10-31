/**
 * Conversation engine: glue between the input channel, the API and the run reducer.
 * It knows nothing about React or about where the text came from (keyboard today,
 * microphone tomorrow). The UI subscribes to `onChange`.
 */
import type { CoachOutput, PlayerProfile, Scenario } from "../../shared/types.ts";
import { askCoach, streamNpc } from "../api.ts";
import { recordCoachOutput, weakPatterns } from "./errorMemory.ts";
import { activeObjective, reduceRun, startRun, type RunAction, type RunState } from "./scenarioState.ts";
import type { InputChannel, OutputChannel } from "../io/channels.ts";

export interface CoachNote {
  id: string;
  npcId: string;
  playerMessage: string;
  output?: CoachOutput;
  error?: string;
}

export interface EngineSnapshot {
  run: RunState;
  profile: PlayerProfile;
  notes: CoachNote[];
  busy: boolean;
}

export interface EngineDeps {
  scenario: Scenario;
  profile: PlayerProfile;
  input: InputChannel;
  output: OutputChannel;
  onChange(snapshot: EngineSnapshot): void;
  onProfileChange(profile: PlayerProfile): void;
  now?: () => Date;
}

export class ConversationEngine {
  private run: RunState;
  private profile: PlayerProfile;
  private notes: CoachNote[] = [];
  private busy = false;
  private stopped = false;
  private abort = new AbortController();

  constructor(private deps: EngineDeps) {
    this.run = startRun(deps.scenario, deps.now?.());
    this.profile = deps.profile;
    this.emit();
  }

  snapshot(): EngineSnapshot {
    return { run: this.run, profile: this.profile, notes: this.notes, busy: this.busy };
  }

  approach(npcId: string) {
    this.dispatch({ type: "approach", npcId });
  }

  /** Main loop: wait for input, talk to the NPC and the coach in parallel, repeat until finished. */
  async start(): Promise<void> {
    while (!this.stopped && !this.run.finished) {
      const text = (await this.deps.input.next()).trim();
      if (this.stopped) return;
      if (!text) continue;
      await this.handlePlayerTurn(text);
    }
  }

  stop() {
    this.stopped = true;
    this.abort.abort();
    this.deps.input.close();
  }

  private async handlePlayerTurn(text: string) {
    const { scenario } = this.deps;
    const npcId = this.run.activeNpcId;
    const objective = activeObjective(scenario, this.run);
    if (!objective) return;
    const conv = this.run.conversations[npcId] ?? { turns: [] };
    const lastNpc = [...conv.turns].reverse().find((t) => t.role === "npc")?.text;

    this.busy = true;
    this.dispatch({ type: "player-says", npcId, text });
    const history = this.run.conversations[npcId]!.turns;

    const note: CoachNote = { id: `${Date.now()}-${this.notes.length}`, npcId, playerMessage: text };
    this.notes = [...this.notes, note];
    this.emit();

    const npcPromise = (async () => {
      this.deps.output.begin(npcId);
      await streamNpc(
        {
          scenarioId: scenario.id,
          npcId,
          objectiveId: objective.id,
          history,
          playerLevel: this.profile.level,
          weakPatterns: weakPatterns(this.profile.errors),
        },
        {
          onDelta: (t) => {
            this.deps.output.delta(t);
            this.dispatch({ type: "npc-delta", npcId, text: t });
          },
          onDone: (reply, objectiveComplete) => {
            this.deps.output.end(reply);
            this.dispatch({ type: "npc-done", npcId, reply, objectiveComplete, objectiveId: objective.id });
          },
          onError: (message) => this.dispatch({ type: "npc-error", npcId, message }),
        },
        this.abort.signal,
      ).catch((e: unknown) => {
        if (!this.abort.signal.aborted) this.dispatch({ type: "npc-error", npcId, message: String(e) });
      });
    })();

    const coachPromise = askCoach(
      { scenarioId: scenario.id, npcId, npcPrompt: lastNpc, playerMessage: text, playerLevel: this.profile.level },
      this.abort.signal,
    )
      .then((output) => {
        this.profile = recordCoachOutput(this.profile, output, { scenarioId: scenario.id, npcId, now: this.deps.now?.() });
        this.deps.onProfileChange(this.profile);
        this.updateNote(note.id, { output });
      })
      .catch((e: unknown) => {
        if (!this.abort.signal.aborted) this.updateNote(note.id, { error: e instanceof Error ? e.message : String(e) });
      });

    await Promise.all([npcPromise, coachPromise]);
    this.busy = false;
    this.emit();
  }

  private updateNote(id: string, patch: Partial<CoachNote>) {
    this.notes = this.notes.map((n) => (n.id === id ? { ...n, ...patch } : n));
    this.emit();
  }

  private dispatch(action: RunAction) {
    this.run = reduceRun(this.deps.scenario, this.run, action);
    this.emit();
  }

  private emit() {
    this.deps.onChange(this.snapshot());
  }
}
