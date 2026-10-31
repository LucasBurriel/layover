import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Npc } from "../../shared/types.ts";
import type { Conversation } from "../game/scenarioState.ts";

interface Props {
  npc: Npc;
  conversation: Conversation;
  busy: boolean;
  finished: boolean;
  onSend(text: string): void;
}

export function Chat({ npc, conversation, busy, finished, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [conversation.turns.length, conversation.pending]);

  useEffect(() => {
    if (!busy) inputRef.current?.focus();
  }, [busy, npc.id]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="chat">
      <header className="chat-head">
        <span className="npc-emoji big" aria-hidden>{npc.emoji}</span>
        <div>
          <strong>{npc.name}</strong>
          <small>{npc.role} · {npc.location}</small>
        </div>
      </header>

      <div className="turns">
        {conversation.turns.map((t, i) => (
          <div key={i} className={`bubble ${t.role}`}>
            {t.text}
          </div>
        ))}
        {conversation.pending !== undefined && (
          <div className="bubble npc streaming">
            {conversation.pending || <span className="typing"><i /><i /><i /></span>}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={finished ? "Scene complete" : `Say something to ${npc.name}…`}
          disabled={busy || finished}
          autoComplete="off"
          aria-label="your message"
        />
        <button type="submit" disabled={busy || finished || !draft.trim()}>
          Say it
        </button>
        {/* TODO(voice): a mic button that feeds a SpeechInputChannel into the same engine. */}
      </form>
    </div>
  );
}
