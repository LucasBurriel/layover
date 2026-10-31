/**
 * Input/output channels. The conversation engine only sees these interfaces, so swapping
 * the keyboard for a microphone (and the chat bubble for a voice) is a new implementation,
 * not a rewrite.
 *
 * TODO(voice): implement SpeechInputChannel with the Web Speech API or a server /stt
 * endpoint (ElevenLabs Scribe / Whisper), and TtsOutputChannel streaming NPC deltas to a
 * TTS voice per NPC. The NPC stream already arrives sentence-by-sentence, so TTS can start
 * on the first sentence while the rest is still generating.
 */

export interface InputChannel {
  /** Resolves with the player's next utterance. */
  next(): Promise<string>;
  /** Stop listening (unmount, scenario finished). */
  close(): void;
}

export interface OutputChannel {
  /** A new NPC turn is starting. */
  begin(npcId: string): void;
  /** Streamed text delta of the current turn. */
  delta(text: string): void;
  /** The turn is complete; `reply` is the full visible text. */
  end(reply: string): void;
}

/** Text input: a queue that the UI pushes into when the player presses Enter. */
export class TextInputChannel implements InputChannel {
  private queue: string[] = [];
  private waiters: ((text: string) => void)[] = [];
  private closed = false;

  push(text: string): void {
    if (this.closed) return;
    const w = this.waiters.shift();
    if (w) w(text);
    else this.queue.push(text);
  }

  next(): Promise<string> {
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  close(): void {
    this.closed = true;
    this.queue = [];
    this.waiters = [];
  }
}

/** Text output: forwards to callbacks the React layer provides. */
export class CallbackOutputChannel implements OutputChannel {
  constructor(
    private handlers: {
      begin(npcId: string): void;
      delta(text: string): void;
      end(reply: string): void;
    },
  ) {}
  begin(npcId: string) {
    this.handlers.begin(npcId);
  }
  delta(text: string) {
    this.handlers.delta(text);
  }
  end(reply: string) {
    this.handlers.end(reply);
  }
}
