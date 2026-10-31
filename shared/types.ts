/**
 * Types shared by the browser, the server and the tests.
 * Everything that crosses the /api boundary is defined here and validated with zod.
 */
import { z } from "zod";

// ---------- CEFR level ----------
export const CEFR_LEVELS = ["A2", "B1", "B2", "C1"] as const;
export type Cefr = (typeof CEFR_LEVELS)[number];
export const CefrSchema = z.enum(CEFR_LEVELS);

// ---------- Scenario data (one JSON file per scenario in /scenarios) ----------
export const NpcSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string(),
  role: z.string(),
  emoji: z.string(),
  /** Short description of who they are and how they talk. Goes into the system prompt verbatim. */
  personality: z.string(),
  /** Facts this NPC knows. They must not invent anything outside this list. */
  knowledge: z.array(z.string()),
  /** Where on the scene map they stand. */
  location: z.string(),
  /** Opening line the NPC says when the player approaches. Optional. */
  greeting: z.string().optional(),
});
export type Npc = z.infer<typeof NpcSchema>;

export const ObjectiveSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  npcId: z.string(),
  title: z.string(),
  /** What the player sees as a hint. */
  hint: z.string(),
  /** What the NPC uses to decide the objective is complete. Not shown to the player. */
  successCriteria: z.string(),
});
export type Objective = z.infer<typeof ObjectiveSchema>;

export const ScenarioSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  emoji: z.string(),
  tagline: z.string(),
  /** The world the NPCs live in: place, time, what is going on. */
  setting: z.string(),
  /** Who the player is in this scene and what they are trying to do. */
  playerRole: z.string(),
  npcs: z.array(NpcSchema).min(1),
  objectives: z.array(ObjectiveSchema).min(1),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

// ---------- Error memory (persisted per player, client side) ----------
export const ERROR_CATEGORIES = [
  "grammar",
  "vocabulary",
  "naturalness",
  "spelling",
  "register",
] as const;
export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];
export const ErrorCategorySchema = z.enum(ERROR_CATEGORIES);

export const CorrectionSchema = z.object({
  category: ErrorCategorySchema,
  /** Short stable label for the underlying pattern, e.g. "articles", "present perfect vs past simple". */
  pattern: z.string(),
  /** The fragment the player wrote. */
  original: z.string(),
  /** How a native speaker would say that fragment. */
  corrected: z.string(),
  /** One-sentence explanation. */
  explanation: z.string(),
});
export type Correction = z.infer<typeof CorrectionSchema>;

export const CoachOutputSchema = z.object({
  corrections: z.array(CorrectionSchema),
  /** The whole player message as a native speaker would have said it. Empty if it was already natural. */
  nativeVersion: z.string(),
  /** Estimated CEFR level of this single message. */
  levelEstimate: CefrSchema,
  /** One short, encouraging remark. */
  praise: z.string(),
});
export type CoachOutput = z.infer<typeof CoachOutputSchema>;

export interface ErrorRecord extends Correction {
  id: string;
  scenarioId: string;
  npcId: string;
  at: string; // ISO date
}

export interface PlayerProfile {
  level: Cefr;
  /** Recent coach estimates, newest last. Used to smooth the level. */
  levelHistory: Cefr[];
  errors: ErrorRecord[];
}

// ---------- API ----------
export const ChatTurnSchema = z.object({
  role: z.enum(["player", "npc"]),
  text: z.string(),
});
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

export const NpcRequestSchema = z.object({
  scenarioId: z.string(),
  npcId: z.string(),
  objectiveId: z.string(),
  /** Full conversation with this NPC so far, oldest first. The last turn is the player's new message. */
  history: z.array(ChatTurnSchema).min(1),
  playerLevel: CefrSchema,
  /** Patterns the player keeps getting wrong. The NPC steers the conversation to make the player use them. */
  weakPatterns: z.array(z.string()).max(5),
});
export type NpcRequest = z.infer<typeof NpcRequestSchema>;

export const CoachRequestSchema = z.object({
  scenarioId: z.string(),
  npcId: z.string(),
  /** What the NPC said just before (context for judging naturalness). */
  npcPrompt: z.string().optional(),
  playerMessage: z.string().min(1),
  playerLevel: CefrSchema,
});
export type CoachRequest = z.infer<typeof CoachRequestSchema>;

/** Server-sent events emitted by POST /api/npc */
export type NpcStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; reply: string; objectiveComplete: boolean }
  | { type: "error"; message: string };

export type ProviderName = "anthropic" | "claude-code" | "mock";

export interface HealthResponse {
  ok: true;
  provider: ProviderName;
  npcModel: string;
  coachModel: string;
}
