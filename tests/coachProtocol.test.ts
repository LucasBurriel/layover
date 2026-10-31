import { describe, expect, it } from "vitest";
import { z } from "zod";
import { COACH_JSON_SCHEMA, parseCoachOutput } from "../shared/coachProtocol.ts";
import { CoachOutputSchema } from "../shared/types.ts";

const valid = {
  corrections: [
    { category: "grammar", pattern: "age with to be", original: "I have 30 years", corrected: "I am 30", explanation: "Age uses to be." },
  ],
  nativeVersion: "I am 30.",
  levelEstimate: "B1",
  praise: "Clear.",
};

describe("parseCoachOutput", () => {
  it("accepts an already-parsed object", () => {
    expect(parseCoachOutput(valid)).toEqual(valid);
  });

  it("accepts a JSON string", () => {
    expect(parseCoachOutput(JSON.stringify(valid))).toEqual(valid);
  });

  it("accepts JSON inside a markdown fence with chatter around it", () => {
    const text = "Here you go:\n```json\n" + JSON.stringify(valid) + "\n```\nHope that helps.";
    expect(parseCoachOutput(text)).toEqual(valid);
  });

  it("accepts JSON preceded by prose without a fence", () => {
    expect(parseCoachOutput("Sure! " + JSON.stringify(valid))).toEqual(valid);
  });

  it("rejects an unknown category", () => {
    const bad = { ...valid, corrections: [{ ...valid.corrections[0], category: "style" }] };
    expect(() => parseCoachOutput(JSON.stringify(bad))).toThrow();
  });

  it("rejects a level outside A2-C1", () => {
    expect(() => parseCoachOutput(JSON.stringify({ ...valid, levelEstimate: "C2" }))).toThrow();
  });

  it("rejects text with no JSON", () => {
    expect(() => parseCoachOutput("no corrections needed")).toThrow(/not valid JSON/);
  });
});

describe("COACH_JSON_SCHEMA stays in sync with CoachOutputSchema", () => {
  it("has the same top-level required keys", () => {
    const zodKeys = Object.keys(CoachOutputSchema.shape).sort();
    expect([...COACH_JSON_SCHEMA.required].sort()).toEqual(zodKeys);
  });

  it("has the same correction keys and enums", () => {
    const corr = z.toJSONSchema(CoachOutputSchema.shape.corrections.element) as { required?: string[]; properties: Record<string, { enum?: string[] }> };
    expect([...COACH_JSON_SCHEMA.properties.corrections.items.required].sort()).toEqual([...(corr.required ?? [])].sort());
    expect(COACH_JSON_SCHEMA.properties.corrections.items.properties.category.enum).toEqual(corr.properties.category?.enum);
    expect(COACH_JSON_SCHEMA.properties.levelEstimate.enum).toEqual(z.toJSONSchema(CoachOutputSchema.shape.levelEstimate).enum);
  });
});
