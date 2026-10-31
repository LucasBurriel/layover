import { describe, expect, it } from "vitest";
import { smoothLevel } from "../src/game/level.ts";

describe("smoothLevel", () => {
  it("keeps the current level with fewer than three estimates", () => {
    expect(smoothLevel(["C1", "C1"], "A2")).toBe("A2");
  });

  it("moves one step towards the rounded mean of the window", () => {
    expect(smoothLevel(["C1", "C1", "C1"], "A2")).toBe("B1");
    expect(smoothLevel(["A2", "A2", "A2"], "C1")).toBe("B2");
  });

  it("stays put when the mean matches", () => {
    expect(smoothLevel(["B2", "B1", "B2", "B2"], "B2")).toBe("B2");
  });

  it("ignores estimates older than the window", () => {
    const history = ["A2", "A2", "A2", "A2", "A2", "A2", "B2", "B2", "B2", "B2", "B2", "B2"] as const;
    expect(smoothLevel([...history], "B2", 6)).toBe("B2");
  });

  it("does not go below A2 or above C1", () => {
    expect(smoothLevel(["A2", "A2", "A2"], "A2")).toBe("A2");
    expect(smoothLevel(["C1", "C1", "C1"], "C1")).toBe("C1");
  });
});
