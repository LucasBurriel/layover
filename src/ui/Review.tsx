import type { PlayerProfile, Scenario } from "../../shared/types.ts";
import type { EngineSnapshot } from "../game/engine.ts";
import { errorsSince, improvedPatterns, patternStats, weakPatterns } from "../game/errorMemory.ts";
import { levelLabel } from "../game/level.ts";

interface Props {
  scenario: Scenario;
  snapshot: EngineSnapshot;
  profile: PlayerProfile;
  onHome(): void;
  onReplay(): void;
}

export function Review({ scenario, snapshot, profile, onHome, onReplay }: Props) {
  const thisRun = errorsSince(profile.errors, snapshot.run.startedAt, scenario.id);
  const runStats = patternStats(thisRun);
  const allTime = patternStats(profile.errors).slice(0, 6);
  const improved = improvedPatterns(profile.errors);
  const turns = snapshot.notes.length;
  const clean = snapshot.notes.filter((n) => n.output && n.output.corrections.length === 0).length;
  const nextFocus = weakPatterns(profile.errors);

  return (
    <main className="review">
      <header className="review-head">
        <span className="stamp">✓ ARRIVED</span>
        <h1>{scenario.emoji} {scenario.title}</h1>
        <p className="lede">
          {turns} messages, {clean} already native-sounding, {thisRun.length} corrections.
          Your level reads <strong>{profile.level}</strong> ({levelLabel(profile.level)}).
        </p>
      </header>

      <section className="review-grid">
        <div className="card">
          <h2>This scene</h2>
          {runStats.length === 0 ? (
            <p className="ok">Nothing to fix. Try a harder scene or push for more complex sentences.</p>
          ) : (
            <ul className="review-list">
              {runStats.map((s) => (
                <li key={s.pattern}>
                  <div className="review-pattern">
                    <span className={`tag tag-${s.category}`}>{s.category}</span>
                    <strong>{s.pattern}</strong>
                    <span className="count">×{s.count}</span>
                  </div>
                  <ul className="examples">
                    {s.examples.map((ex, i) => (
                      <li key={i}>
                        <del>{ex.original}</del> → <ins>{ex.corrected}</ins>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>Your file</h2>
          {allTime.length === 0 ? (
            <p className="muted">Empty.</p>
          ) : (
            <ul className="patterns">
              {allTime.map((s) => (
                <li key={s.pattern}>
                  <span className={`tag tag-${s.category}`}>{s.category}</span>
                  <span className="pattern">{s.pattern}</span>
                  <span className="count">×{s.count}</span>
                </li>
              ))}
            </ul>
          )}
          {improved.length > 0 && (
            <>
              <h3>Not seen lately</h3>
              <p className="ok">{improved.join(" · ")}</p>
            </>
          )}
          {nextFocus.length > 0 && (
            <>
              <h3>Next scene, the characters will push you on</h3>
              <p>{nextFocus.join(" · ")}</p>
            </>
          )}
        </div>
      </section>

      <footer className="review-actions">
        <button className="primary" onClick={onReplay}>Play again</button>
        <button onClick={onHome}>Back to departures</button>
      </footer>
    </main>
  );
}
