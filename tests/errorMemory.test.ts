import { describe, expect, it } from "vitest";
import type { CoachOutput, ErrorRecord } from "../shared/types.ts";
import {
  emptyProfile,
  errorsSince,
  improvedPatterns,
  normalizePattern,
  patternStats,
  recordCoachOutput,
  weakPatterns,
} from "../src/game/errorMemory.ts";

let seq = 0;
const ctx = (scenarioId = "airport", day = 1) => ({
  scenarioId,
  npcId: "checkin",
  now: new Date(Date.UTC(2026, 0, day)),
  idFactory: () => `id-${++seq}`,
});

function coach(patterns: string[], level: CoachOutput["levelEstimate"] = "B1"): CoachOutput {
  return {
    corrections: patterns.map((p) => ({ category: "grammar", pattern: p, original: "x", corrected: "y", explanation: "z" })),
    nativeVersion: "",
    levelEstimate: level,
    praise: "",
  };
}

describe("recordCoachOutput", () => {
  it("appends one record per correction with context and a normalised pattern", () => {
    const p = recordCoachOutput(emptyProfile(), coach(["Articles.", "ARTICLES"]), ctx());
    expect(p.errors).toHaveLength(2);
    expect(p.errors.map((e) => e.pattern)).toEqual(["articles", "articles"]);
    expect(p.errors[0]).toMatchObject({ scenarioId: "airport", npcId: "checkin", at: "2026-01-01T00:00:00.000Z" });
    expect(p.levelHistory).toEqual(["B1"]);
  });

  it("does not mutate the previous profile", () => {
    const before = emptyProfile();
    recordCoachOutput(before, coach(["articles"]), ctx());
    expect(before.errors).toHaveLength(0);
  });

  it("keeps the level stable until enough estimates accumulate, then moves one step", () => {
    let p = emptyProfile("B1");
    p = recordCoachOutput(p, coach([], "C1"), ctx());
    p = recordCoachOutput(p, coach([], "C1"), ctx());
    expect(p.level).toBe("B1");
    p = recordCoachOutput(p, coach([], "C1"), ctx());
    expect(p.level).toBe("B2"); // one step at a time, never B1 -> C1
    p = recordCoachOutput(p, coach([], "C1"), ctx());
    expect(p.level).toBe("C1");
  });
});

describe("normalizePattern", () => {
  it("lowercases, trims, collapses spaces and drops trailing punctuation", () => {
    expect(normalizePattern("  Present  Perfect vs Past Simple: ")).toBe("present perfect vs past simple");
  });
});

describe("patternStats and weakPatterns", () => {
  const errors = (): ErrorRecord[] => {
    let p = emptyProfile();
    p = recordCoachOutput(p, coach(["articles", "prepositions"]), ctx("airport", 1));
    p = recordCoachOutput(p, coach(["articles"]), ctx("airport", 2));
    p = recordCoachOutput(p, coach(["false friend: actually"]), ctx("hotel", 3));
    return p.errors;
  };

  it("counts by pattern, most frequent first", () => {
    const stats = patternStats(errors());
    expect(stats.map((s) => [s.pattern, s.count])).toEqual([
      ["articles", 2],
      ["false friend: actually", 1],
      ["prepositions", 1],
    ]);
    expect(stats[0]?.examples).toHaveLength(2);
  });

  it("weakPatterns prefers recurring patterns, then the most recent ones", () => {
    expect(weakPatterns(errors(), 2)).toEqual(["articles", "false friend: actually"]);
  });

  it("weakPatterns is empty for a new player", () => {
    expect(weakPatterns([])).toEqual([]);
  });

  it("errorsSince filters by scenario and time", () => {
    expect(errorsSince(errors(), "2026-01-02T00:00:00.000Z", "airport").map((e) => e.pattern)).toEqual(["articles"]);
  });
});

describe("improvedPatterns", () => {
  it("reports recurring patterns absent from the recent window", () => {
    let p = emptyProfile();
    for (let i = 0; i < 3; i++) p = recordCoachOutput(p, coach(["articles"]), ctx("airport", i + 1));
    for (let i = 0; i < 16; i++) p = recordCoachOutput(p, coach(["prepositions"]), ctx("airport", i + 4));
    expect(improvedPatterns(p.errors)).toEqual(["articles"]);
  });

  it("is empty when there is too little history", () => {
    const p = recordCoachOutput(emptyProfile(), coach(["articles", "articles"]), ctx());
    expect(improvedPatterns(p.errors)).toEqual([]);
  });
});
