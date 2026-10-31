import type { HealthResponse, PlayerProfile, Scenario } from "../../shared/types.ts";
import { patternStats } from "../game/errorMemory.ts";
import { levelLabel } from "../game/level.ts";

interface Props {
  scenarios: Scenario[];
  profile: PlayerProfile;
  health: HealthResponse | null;
  error: string | null;
  onPlay(scenario: Scenario): void;
  onReset(): void;
}

export function Home({ scenarios, profile, health, error, onPlay, onReset }: Props) {
  const stats = patternStats(profile.errors).slice(0, 5);
  return (
    <main className="home">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark">✈</span>
          <h1>Layover</h1>
        </div>
        <p className="lede">
          Real-life situations, characters who only speak English, and a coach who remembers what you get wrong.
        </p>
      </header>

      <section className="board">
        <div className="board-head">
          <span>Departures</span>
          <span>Status</span>
        </div>
        {error && <p className="error">{error}</p>}
        {!error && scenarios.length === 0 && <p className="muted">Loading scenarios…</p>}
        {scenarios.map((s) => (
          <button key={s.id} className="board-row" onClick={() => onPlay(s)}>
            <span className="board-emoji" aria-hidden>{s.emoji}</span>
            <span className="board-title">
              <strong>{s.title}</strong>
              <small>{s.tagline}</small>
            </span>
            <span className="board-meta">
              {s.npcs.length} characters · {s.objectives.length} goals
              <em>Boarding</em>
            </span>
          </button>
        ))}
      </section>

      <section className="passport">
        <div className="passport-head">
          <h2>Your passport</h2>
          <button className="link" onClick={onReset}>reset</button>
        </div>
        <dl>
          <div>
            <dt>Level</dt>
            <dd>
              <span className="level-pill">{profile.level}</span> {levelLabel(profile.level)}
            </dd>
          </div>
          <div>
            <dt>Corrections recorded</dt>
            <dd>{profile.errors.length}</dd>
          </div>
        </dl>
        {stats.length > 0 ? (
          <>
            <h3>Patterns the characters will push you on</h3>
            <ul className="patterns">
              {stats.map((s) => (
                <li key={s.pattern}>
                  <span className={`tag tag-${s.category}`}>{s.category}</span>
                  <span className="pattern">{s.pattern}</span>
                  <span className="count">×{s.count}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">Nothing recorded yet. Play a scene and the coach will start a file on you.</p>
        )}
      </section>

      <footer className="foot">
        {health ? (
          <span>
            model {health.npcModel} via {health.provider}
            {health.provider === "mock" && " (mock mode, no model)"}
          </span>
        ) : (
          <span>server offline</span>
        )}
      </footer>
    </main>
  );
}
