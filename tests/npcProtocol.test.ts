import { describe, expect, it } from "vitest";
import { NpcStreamFilter, OBJECTIVE_COMPLETE_TAG, parseNpcReply } from "../shared/npcProtocol.ts";

describe("parseNpcReply", () => {
  it("returns the text and no completion when there is no trailer", () => {
    expect(parseNpcReply("Where are you flying to?\n")).toEqual({ reply: "Where are you flying to?", objectiveComplete: false });
  });

  it("strips the trailer and flags completion", () => {
    expect(parseNpcReply(`Here is your boarding pass.\n${OBJECTIVE_COMPLETE_TAG}`)).toEqual({
      reply: "Here is your boarding pass.",
      objectiveComplete: true,
    });
  });

  it("hides any other bracketed tag without flagging completion", () => {
    expect(parseNpcReply("Sure. [[MOOD: annoyed]]")).toEqual({ reply: "Sure.", objectiveComplete: false });
  });
});

describe("NpcStreamFilter", () => {
  function run(deltas: string[]) {
    const f = new NpcStreamFilter();
    const out = deltas.map((d) => f.push(d));
    return out.join("") + f.flush();
  }

  it("passes ordinary text through unchanged", () => {
    expect(run(["Hel", "lo the", "re."])).toBe("Hello there.");
  });

  it("never shows the trailer, even when it is split across deltas", () => {
    expect(run(["Done.\n", "[", "[OBJECTIVE_", "COMPLETE]]"])).toBe("Done.\n");
  });

  it("releases a lone bracket that turned out to be innocent", () => {
    expect(run(["Row 28 [window", "] is free."])).toBe("Row 28 [window] is free.");
  });

  it("releases a trailing bracket on flush", () => {
    expect(run(["see note [", ""])).toBe("see note [");
  });

  it("emits nothing after the trailer starts", () => {
    const f = new NpcStreamFilter();
    expect(f.push("Bye. [[OBJ")).toBe("Bye. ");
    expect(f.push("ECTIVE_COMPLETE]] and more")).toBe("");
    expect(f.flush()).toBe("");
  });
});
