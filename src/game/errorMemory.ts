/**
 * Error memory: every correction the coach makes is stored per player and reused in two
 * places: the end-of-scenario review, and the NPC prompt (weak patterns the NPCs provoke).
 * Pure functions over PlayerProfile; persistence lives in storage.ts.
 */
import type { Cefr, CoachOutput, ErrorRecord, PlayerProfile } from "../../shared/types.ts";
import { smoothLevel } from "./level.ts";

export const MAX_ERRORS = 500;

export function emptyProfile(level: Cefr = "B1"): PlayerProfile {
  return { level, levelHistory: [], errors: [] };
}

export interface RecordContext {
  scenarioId: string;
  npcId: string;
  now?: Date;
  idFactory?: () => string;
}

/** Fold one coach output into the profile. Returns a new profile. */
export function recordCoachOutput(profile: PlayerProfile, coach: CoachOutput, ctx: RecordContext): PlayerProfile {
  const at = (ctx.now ?? new Date()).toISOString();
  const makeId = ctx.idFactory ?? defaultId;
  const fresh: ErrorRecord[] = coach.corrections.map((c) => ({
    ...c,
    pattern: normalizePattern(c.pattern),
    id: makeId(),
    scenarioId: ctx.scenarioId,
    npcId: ctx.npcId,
    at,
  }));
  const errors = [...profile.errors, ...fresh].slice(-MAX_ERRORS);
  const levelHistory = [...profile.levelHistory, coach.levelEstimate].slice(-20);
  return { level: smoothLevel(levelHistory, profile.level), levelHistory, errors };
}

/** Lowercase, trim, collapse whitespace, strip trailing punctuation so labels merge. */
export function normalizePattern(p: string): string {
  return p.toLowerCase().replace(/\s+/g, " ").trim().replace(/[.:;,!]+$/g, "").trim();
}

export interface PatternStat {
  pattern: string;
  count: number;
  category: ErrorRecord["category"];
  lastAt: string;
  examples: { original: string; corrected: string }[];
}

/** Aggregate errors by pattern, most frequent first; ties broken by recency. */
export function patternStats(errors: ErrorRecord[]): PatternStat[] {
  const map = new Map<string, PatternStat>();
  for (const e of errors) {
    const s = map.get(e.pattern) ?? { pattern: e.pattern, count: 0, category: e.category, lastAt: e.at, examples: [] };
    s.count += 1;
    if (e.at > s.lastAt) s.lastAt = e.at;
    if (s.examples.length < 3) s.examples.push({ original: e.original, corrected: e.corrected });
    map.set(e.pattern, s);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || (a.lastAt < b.lastAt ? 1 : -1));
}

/**
 * The patterns the NPCs should provoke: recurring ones (seen at least twice) first; if the
 * player is new, the most recent ones. Capped so the prompt stays short.
 */
export function weakPatterns(errors: ErrorRecord[], max = 3): string[] {
  const stats = patternStats(errors);
  const recurring = stats.filter((s) => s.count >= 2).slice(0, max);
  if (recurring.length >= Math.min(max, stats.length)) return recurring.map((s) => s.pattern);
  const seen = new Set(recurring.map((s) => s.pattern));
  const recent = stats
    .filter((s) => !seen.has(s.pattern))
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1))
    .slice(0, max - recurring.length);
  return [...recurring, ...recent].map((s) => s.pattern);
}

/** Errors made during one scenario run, for the review screen. */
export function errorsSince(errors: ErrorRecord[], since: string, scenarioId: string): ErrorRecord[] {
  return errors.filter((e) => e.scenarioId === scenarioId && e.at >= since);
}

/** Patterns the player used to fail but has not failed in the last `window` corrections. */
export function improvedPatterns(errors: ErrorRecord[], window = 15): string[] {
  if (errors.length <= window) return [];
  const old = patternStats(errors.slice(0, -window)).filter((s) => s.count >= 2);
  const recent = new Set(errors.slice(-window).map((e) => e.pattern));
  return old.filter((s) => !recent.has(s.pattern)).map((s) => s.pattern);
}

function defaultId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
