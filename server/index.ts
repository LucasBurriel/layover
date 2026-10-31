/**
 * Minimal backend. Holds the API key, serves scenarios, and exposes two endpoints:
 *   POST /api/npc   -> SSE stream of the NPC's in-character reply + objective state
 *   POST /api/coach -> JSON with corrections, native version, level estimate
 * `--mock` runs without a model. `--serve-dist` also serves the built frontend.
 */
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCoachOutput, COACH_JSON_SCHEMA } from "../shared/coachProtocol.ts";
import { parseNpcReply } from "../shared/npcProtocol.ts";
import { CoachRequestSchema, NpcRequestSchema, type HealthResponse, type NpcStreamEvent } from "../shared/types.ts";
import { coachSystemPrompt, coachUserMessage, npcSystemPrompt } from "./prompts.ts";
import { createProvider, resolveProviderName } from "./providers/index.ts";
import type { ChatMessage } from "./providers/types.ts";
import { loadScenarios } from "./scenarios.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
loadDotEnv(join(root, ".env"));

const args = new Set(process.argv.slice(2));
const providerName = resolveProviderName(process.env, args.has("--mock"));
const provider = createProvider(providerName);
const NPC_MODEL = process.env.NPC_MODEL ?? "claude-opus-5-5";
const COACH_MODEL = process.env.COACH_MODEL ?? "claude-opus-5-5";
const PORT = Number(process.env.PORT ?? 8787);

const scenarios = loadScenarios(join(root, "scenarios"));

export const app = new Hono();

app.get("/api/health", (c) => {
  const body: HealthResponse = { ok: true, provider: providerName, npcModel: NPC_MODEL, coachModel: COACH_MODEL };
  return c.json(body);
});

app.get("/api/scenarios", (c) => c.json([...scenarios.values()]));

app.post("/api/npc", async (c) => {
  const parsed = NpcRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const req = parsed.data;
  const scenario = scenarios.get(req.scenarioId);
  const npc = scenario?.npcs.find((n) => n.id === req.npcId);
  const objective = scenario?.objectives.find((o) => o.id === req.objectiveId);
  if (!scenario || !npc || !objective) return c.json({ error: "unknown scenario, npc or objective" }, 404);

  const messages: ChatMessage[] = req.history.map((t) => ({
    role: t.role === "player" ? "user" : "assistant",
    content: t.text,
  }));
  // The API requires the first message to be from the user. If the NPC opened with a
  // greeting, fold it into the system-level context by prepending a neutral player turn.
  if (messages[0]?.role === "assistant") messages.unshift({ role: "user", content: "(The player walks up to you.)" });

  return streamSSE(c, async (stream) => {
    const send = (ev: NpcStreamEvent) => stream.writeSSE({ data: JSON.stringify(ev) });
    let raw = "";
    try {
      for await (const delta of provider.stream({
        model: NPC_MODEL,
        system: npcSystemPrompt(scenario, npc, objective, req),
        messages,
        maxTokens: 1024,
        effort: "low",
      })) {
        raw += delta;
        await send({ type: "delta", text: delta });
      }
      const { reply, objectiveComplete } = parseNpcReply(raw);
      await send({ type: "done", reply, objectiveComplete });
    } catch (e) {
      console.error("[npc]", e);
      await send({ type: "error", message: e instanceof Error ? e.message : String(e) });
    }
  });
});

app.post("/api/coach", async (c) => {
  const parsed = CoachRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const req = parsed.data;
  const scenario = scenarios.get(req.scenarioId);
  const npc = scenario?.npcs.find((n) => n.id === req.npcId);
  if (!scenario || !npc) return c.json({ error: "unknown scenario or npc" }, 404);
  try {
    const result = await provider.structured({
      model: COACH_MODEL,
      system: coachSystemPrompt(scenario, npc, req),
      messages: [{ role: "user", content: coachUserMessage(req) }],
      maxTokens: 2048,
      effort: "medium",
      schema: COACH_JSON_SCHEMA as unknown as Record<string, unknown>,
    });
    return c.json(parseCoachOutput(result));
  } catch (e) {
    console.error("[coach]", e);
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 502);
  }
});

if (args.has("--serve-dist") && existsSync(join(root, "dist"))) {
  app.use("/*", serveStatic({ root: "./dist" }));
  app.get("*", serveStatic({ path: "./dist/index.html" }));
}

console.log("[layover] starting…");
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`layover server on http://localhost:${PORT}  provider=${providerName}  npc=${NPC_MODEL}  coach=${COACH_MODEL}`);
});

/** Tiny .env loader so there is no dotenv dependency. Does not override existing vars. */
function loadDotEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith("#")) continue;
    const key = m[1]!;
    const value = m[2]!.replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
