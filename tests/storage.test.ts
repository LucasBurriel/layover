import { describe, expect, it } from "vitest";
import { loadProfile, saveProfile, type KeyValue } from "../src/game/storage.ts";
import { emptyProfile } from "../src/game/errorMemory.ts";

function memStore(initial: Record<string, string> = {}): KeyValue & { data: Record<string, string> } {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}

describe("storage", () => {
  it("round-trips a profile", () => {
    const store = memStore();
    const p = { ...emptyProfile("B2"), levelHistory: ["B2" as const] };
    saveProfile(store, p);
    expect(loadProfile(store)).toEqual(p);
  });

  it("falls back to an empty profile on garbage", () => {
    expect(loadProfile(memStore({ "layover.profile.v1": "{not json" }))).toEqual(emptyProfile());
  });

  it("fills missing fields from an older profile shape", () => {
    expect(loadProfile(memStore({ "layover.profile.v1": JSON.stringify({ level: "C1" }) }))).toEqual({ level: "C1", levelHistory: [], errors: [] });
  });

  it("survives a store that throws", () => {
    const broken: KeyValue = { getItem: () => { throw new Error("quota"); }, setItem: () => { throw new Error("quota"); } };
    expect(loadProfile(broken)).toEqual(emptyProfile());
    expect(() => saveProfile(broken, emptyProfile())).not.toThrow();
  });
});
