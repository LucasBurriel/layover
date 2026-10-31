import { useEffect, useMemo, useState } from "react";
import type { HealthResponse, PlayerProfile, Scenario } from "../shared/types.ts";
import { fetchHealth, fetchScenarios } from "./api.ts";
import { loadProfile, saveProfile } from "./game/storage.ts";
import { Home } from "./ui/Home.tsx";
import { Review } from "./ui/Review.tsx";
import { Scene } from "./ui/Scene.tsx";
import type { EngineSnapshot } from "./game/engine.ts";

type Screen = { name: "home" } | { name: "scene"; scenario: Scenario } | { name: "review"; scenario: Scenario; snapshot: EngineSnapshot };

export function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile(localStorage));
  const [screen, setScreen] = useState<Screen>({ name: "home" });

  useEffect(() => {
    fetchScenarios().then(setScenarios).catch((e) => setError(`Cannot reach the server: ${e.message}. Is \`npm run dev\` running?`));
    fetchHealth().then(setHealth).catch(() => undefined);
  }, []);

  useEffect(() => saveProfile(localStorage, profile), [profile]);

  const resetProfile = () => {
    if (confirm("Forget every recorded error and reset your level to B1?")) {
      setProfile({ level: "B1", levelHistory: [], errors: [] });
    }
  };

  const body = useMemo(() => {
    switch (screen.name) {
      case "home":
        return (
          <Home
            scenarios={scenarios}
            profile={profile}
            health={health}
            error={error}
            onPlay={(scenario) => setScreen({ name: "scene", scenario })}
            onReset={resetProfile}
          />
        );
      case "scene":
        return (
          <Scene
            scenario={screen.scenario}
            profile={profile}
            onProfileChange={setProfile}
            onQuit={() => setScreen({ name: "home" })}
            onFinished={(snapshot) => setScreen({ name: "review", scenario: screen.scenario, snapshot })}
          />
        );
      case "review":
        return (
          <Review
            scenario={screen.scenario}
            snapshot={screen.snapshot}
            profile={profile}
            onHome={() => setScreen({ name: "home" })}
            onReplay={() => setScreen({ name: "scene", scenario: screen.scenario })}
          />
        );
    }
  }, [screen, scenarios, profile, health, error]);

  return <div className="app">{body}</div>;
}
