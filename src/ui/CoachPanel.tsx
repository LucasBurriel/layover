import type { Scenario } from "../../shared/types.ts";
import type { CoachNote } from "../game/engine.ts";

interface Props {
  notes: CoachNote[];
  scenario: Scenario;
}

/** The coach never interrupts the conversation: it annotates in the margin. */
export function CoachPanel({ notes, scenario }: Props) {
  const recent = [...notes].reverse().slice(0, 8);
  return (
    <div className="coach">
      <header className="coach-head">
        <span className="coach-mark">🎓</span>
        <div>
          <strong>Coach</strong>
          <small>reads over your shoulder</small>
        </div>
      </header>
      {recent.length === 0 && <p className="muted">Say something and the coach will tell you how a native speaker would have put it.</p>}
      {recent.map((n) => (
        <article key={n.id} className="note">
          <p className="note-you">
            <span className="who">{scenario.npcs.find((x) => x.id === n.npcId)?.name ?? "NPC"} ←</span> “{n.playerMessage}”
          </p>
          {!n.output && !n.error && <p className="muted small">thinking…</p>}
          {n.error && <p className="error small">coach unavailable: {n.error}</p>}
          {n.output && (
            <>
              {n.output.corrections.length === 0 ? (
                <p className="ok">✓ Natural. {n.output.praise}</p>
              ) : (
                <>
                  <ul className="fixes">
                    {n.output.corrections.map((c, i) => (
                      <li key={i}>
                        <span className={`tag tag-${c.category}`}>{c.category}</span>
                        <span className="fix">
                          <del>{c.original}</del> → <ins>{c.corrected}</ins>
                        </span>
                        <small>{c.explanation}</small>
                      </li>
                    ))}
                  </ul>
                  {n.output.nativeVersion && n.output.nativeVersion !== n.playerMessage && (
                    <p className="native">
                      <span className="who">native</span> “{n.output.nativeVersion}”
                    </p>
                  )}
                  <p className="praise">{n.output.praise}</p>
                </>
              )}
              <span className="est" title="estimated level of this message">{n.output.levelEstimate}</span>
            </>
          )}
        </article>
      ))}
    </div>
  );
}
