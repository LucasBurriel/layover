import type { PlayerProfile } from "../../shared/types.ts";
import { emptyProfile } from "./errorMemory.ts";

const KEY = "layover.profile.v1";

/** Minimal storage abstraction: localStorage in the browser, anything key/value in tests. */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadProfile(store: KeyValue): PlayerProfile {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return emptyProfile();
    const parsed = JSON.parse(raw) as Partial<PlayerProfile>;
    return {
      level: parsed.level ?? "B1",
      levelHistory: Array.isArray(parsed.levelHistory) ? parsed.levelHistory : [],
      errors: Array.isArray(parsed.errors) ? parsed.errors : [],
    };
  } catch {
    return emptyProfile();
  }
}

export function saveProfile(store: KeyValue, profile: PlayerProfile): void {
  try {
    store.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Private mode or quota: the game still works for this session.
  }
}

export function exportProfile(profile: PlayerProfile): string {
  return JSON.stringify(profile, null, 2);
}
