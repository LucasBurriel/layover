import { useEffect, useRef, useState } from "react";
import type { PlayerProfile, Scenario } from "../../shared/types.ts";
import { ConversationEngine, type EngineSnapshot } from "../game/engine.ts";
import { activeObjective, progress } from "../game/scenarioState.ts";
import { CallbackOutputChannel, TextInputChannel } from "../io/channels.ts";
import { Chat } from "./Chat.tsx";
import { CoachPanel } from "./CoachPanel.tsx";
import { SceneMap } from "./SceneMap.tsx";

interface Props {
  scenario: Scenario;
  profile: PlayerProfile;
  onProfileChange(profile: PlayerProfile): void;
  onQuit(): void;
  onFinished(snapshot: EngineSnapshot): void;
}

export function Scene({ scenario, profile, onProfileChange, onQuit, onFinished }: Props) {
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const inputRef = useRef<TextInputChannel | null>(null);
  const engineRef = useRef<ConversationEngine | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    finishedRef.current = false;
    // The channel is created with the engine (not memoised) because React StrictMode
    // mounts effects twice and the first engine closes its channel on stop().
    const input = new TextInputChannel();
    inputRef.current = input;
    const engine = new ConversationEngine({
      scenario,
      profile,
      input,
      output: new CallbackOutputChannel({ begin() {}, delta() {}, end() {} }),
      onChange: setSnapshot,
      onProfileChange,
    });
    engineRef.current = engine;
    void engine.start();
    return () => engine.stop();
    // The engine owns the profile for the duration of the run; re-creating it on every
    // profile change would restart the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  // Hand over to the review screen once the last objective is done and the coach is in.
  useEffect(() => {
    if (snapshot?.run.finished && !snapshot.busy && !finishedRef.current) {
      finishedRef.current = true;
      const t = setTimeout(() => onFinished(snapshot), 1200);
      return () => clearTimeout(t);
    }
  }, [snapshot, onFinished]);

  if (!snapshot) return null;
  const { run, notes, busy } = snapshot;
  const npc = scenario.npcs.find((n) => n.id === run.activeNpcId)!;
  const objective = activeObjective(scenario, run);
  const conv = run.conversations[npc.id] ?? { turns: [] };
  const { done, total } = progress(scenario, run);

  return (
    <main className="scene">
      <header className="scene-bar">
        <button className="link" onClick={onQuit}>← leave</button>
        <h1>
          <span aria-hidden>{scenario.emoji}</span> {scenario.title}
        </h1>
        <span className="progress" title="objectives completed">
          {Array.from({ length: total }, (_, i) => (
            <i key={i} className={i < done ? "dot on" : "dot"} />
          ))}
        </span>
        <span className="level-pill" title="your estimated level">{snapshot.profile.level}</span>
      </header>

      <div className="scene-grid">
        <aside className="map-col">
          <SceneMap
            scenario={scenario}
            run={run}
            onApproach={(id) => engineRef.current?.approach(id)}
          />
          {objective && (
            <div className="objective">
              <span className="objective-label">Goal {run.currentObjective + 1} of {total}</span>
              <strong>{objective.title}</strong>
              <p>{objective.hint}</p>
              {objective.npcId !== npc.id && (
                <p className="warn">This goal is with {scenario.npcs.find((n) => n.id === objective.npcId)?.name}. You can still chat with {npc.name}.</p>
              )}
            </div>
          )}
        </aside>

        <section className="chat-col">
          <Chat
            npc={npc}
            conversation={conv}
            busy={busy}
            finished={run.finished}
            onSend={(text) => inputRef.current?.push(text)}
          />
        </section>

        <aside className="coach-col">
          <CoachPanel notes={notes} scenario={scenario} />
        </aside>
      </div>
    </main>
  );
}
