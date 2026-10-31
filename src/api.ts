import { NpcStreamFilter } from "../shared/npcProtocol.ts";
import type {
  CoachOutput,
  CoachRequest,
  HealthResponse,
  NpcRequest,
  NpcStreamEvent,
  Scenario,
} from "../shared/types.ts";

export async function fetchHealth(): Promise<HealthResponse> {
  const r = await fetch("/api/health");
  if (!r.ok) throw new Error(`health ${r.status}`);
  return r.json();
}

export async function fetchScenarios(): Promise<Scenario[]> {
  const r = await fetch("/api/scenarios");
  if (!r.ok) throw new Error(`scenarios ${r.status}`);
  return r.json();
}

export interface NpcStreamHandlers {
  onDelta(text: string): void;
  onDone(reply: string, objectiveComplete: boolean): void;
  onError(message: string): void;
}

/** POST /api/npc and read the SSE stream. The trailer is hidden client-side as well, so a slow server never leaks it. */
export async function streamNpc(req: NpcRequest, handlers: NpcStreamHandlers, signal?: AbortSignal): Promise<void> {
  const r = await fetch("/api/npc", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!r.ok || !r.body) {
    handlers.onError(`server ${r.status}`);
    return;
  }
  const filter = new NpcStreamFilter();
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("\n");
      if (!data) continue;
      const ev = JSON.parse(data) as NpcStreamEvent;
      if (ev.type === "delta") {
        const visible = filter.push(ev.text);
        if (visible) handlers.onDelta(visible);
      } else if (ev.type === "done") {
        const rest = filter.flush();
        if (rest) handlers.onDelta(rest);
        handlers.onDone(ev.reply, ev.objectiveComplete);
      } else if (ev.type === "error") {
        handlers.onError(ev.message);
      }
    }
  }
}

export async function askCoach(req: CoachRequest, signal?: AbortSignal): Promise<CoachOutput> {
  const r = await fetch("/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!r.ok) throw new Error(`coach ${r.status}`);
  return r.json();
}
