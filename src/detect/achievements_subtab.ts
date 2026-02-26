import { DetectedTarget, FrameSnapshot } from "../types.js";
import { hasTokenContaining, normalizedTokenTexts } from "./text_utils.js";

export function isAchievementsSubtabSelected(snapshot: FrameSnapshot): boolean {
  if (snapshot.signals?.achievementsSubtabSelected !== undefined) {
    return snapshot.signals.achievementsSubtabSelected;
  }
  const lower = normalizedTokenTexts(snapshot);
  return (
    (hasTokenContaining(lower, "show") && hasTokenContaining(lower, "completed")) ||
    (hasTokenContaining(lower, "show") && hasTokenContaining(lower, "locked")) ||
    (hasTokenContaining(lower, "select") && hasTokenContaining(lower, "category"))
  );
}

export function detectAchievementsSubtabTarget(snapshot: FrameSnapshot): DetectedTarget | null {
  if (snapshot.signals?.achievementsSubtabTarget) {
    return snapshot.signals.achievementsSubtabTarget;
  }
  const token = snapshot.tokens.find((t) => t.text.toLowerCase().includes("achievements"));
  if (!token?.rect) return null;
  return {
    rect: token.rect,
    confidence: token.confidence ?? 0.75,
  };
}
