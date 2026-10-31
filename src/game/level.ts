import { CEFR_LEVELS, type Cefr } from "../../shared/types.ts";

/**
 * The coach estimates a level per message; single messages are noisy ("Yes." says nothing).
 * The player's level is the rounded mean of the last `window` estimates, and it only moves
 * one step at a time so the NPCs do not whiplash between A2 and C1.
 */
export function smoothLevel(history: Cefr[], current: Cefr, window = 6): Cefr {
  const recent = history.slice(-window);
  if (recent.length < 3) return current;
  const mean = recent.reduce((acc, l) => acc + CEFR_LEVELS.indexOf(l), 0) / recent.length;
  const target = Math.round(mean);
  const cur = CEFR_LEVELS.indexOf(current);
  const next = cur + Math.sign(target - cur);
  return CEFR_LEVELS[Math.max(0, Math.min(CEFR_LEVELS.length - 1, next))]!;
}

export function levelLabel(level: Cefr): string {
  return { A2: "Elementary", B1: "Intermediate", B2: "Upper intermediate", C1: "Advanced" }[level];
}
