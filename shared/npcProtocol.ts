/**
 * The NPC speaks in character as plain streamed text. State travels in a trailer the
 * player never sees: the reply ends with `[[OBJECTIVE_COMPLETE]]` when the player has
 * obtained what this objective required. This keeps streaming trivial (no partial-JSON
 * parsing) and works with any provider that returns text.
 */
export const OBJECTIVE_COMPLETE_TAG = "[[OBJECTIVE_COMPLETE]]";

export interface ParsedNpcReply {
  reply: string;
  objectiveComplete: boolean;
}

/** Final parse of a complete NPC reply. */
export function parseNpcReply(raw: string): ParsedNpcReply {
  const idx = raw.indexOf("[[");
  if (idx === -1) return { reply: raw.trim(), objectiveComplete: false };
  const visible = raw.slice(0, idx).trim();
  const trailer = raw.slice(idx);
  return { reply: visible, objectiveComplete: trailer.includes(OBJECTIVE_COMPLETE_TAG) };
}

/**
 * Incremental filter for streaming. Feed it deltas; it returns the text that is safe to
 * show. Anything from a `[` that could start the trailer is held back until we know.
 */
export class NpcStreamFilter {
  private buffer = "";
  private sealed = false;

  push(delta: string): string {
    if (this.sealed) return "";
    this.buffer += delta;
    const open = this.buffer.indexOf("[[");
    if (open !== -1) {
      // Trailer started: emit what came before, hide the rest forever.
      const out = this.buffer.slice(0, open);
      this.buffer = this.buffer.slice(open);
      this.sealed = true;
      return out;
    }
    // A lone trailing "[" might be the start of "[[" - hold it back.
    if (this.buffer.endsWith("[")) {
      const out = this.buffer.slice(0, -1);
      this.buffer = "[";
      return out;
    }
    const out = this.buffer;
    this.buffer = "";
    return out;
  }

  /** Call at end of stream: returns any held-back text that turned out to be innocent. */
  flush(): string {
    if (this.sealed) return "";
    const out = this.buffer;
    this.buffer = "";
    return out;
  }
}
