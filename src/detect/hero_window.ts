import { DetectedTarget, FrameSnapshot, Rect } from "../types.js";
import {
  countTokensContaining,
  hasTokenContaining,
  normalizedTokenTexts,
} from "./text_utils.js";

const HERO_TABS = ["summary", "skills", "loadout", "achievements"];

export function detectHeroWindow(snapshot: FrameSnapshot): DetectedTarget | null {
  if (snapshot.signals?.heroWindowTarget) {
    return snapshot.signals.heroWindowTarget;
  }
  if (snapshot.signals?.hasHeroWindow) {
    const signalRect = deriveHeroRect(snapshot);
    if (signalRect) {
      return { rect: signalRect, confidence: 0.66 };
    }
  }
  const lower = normalizedTokenTexts(snapshot);
  const hasHeroHeading = hasTokenContaining(lower, "hero");
  const tabHits = HERO_TABS.filter((tab) =>
    hasTokenContaining(lower, tab),
  ).length;
  const hasTabSignature = tabHits >= 3 && hasTokenContaining(lower, "achievements");
  if (!(hasHeroHeading || hasTabSignature)) return null;

  const rect = deriveHeroRect(snapshot) ?? { x: 0, y: 0, width: 1, height: 1 };
  return {
    rect,
    confidence: Math.min(1, 0.5 + tabHits * 0.12),
  };
}

export function isAchievementsTopTabSelected(snapshot: FrameSnapshot): boolean {
  if (snapshot.signals?.achievementsTopTabSelected !== undefined) {
    return snapshot.signals.achievementsTopTabSelected;
  }
  const lower = normalizedTokenTexts(snapshot);
  const achievementsMentions = countTokensContaining(lower, "achievements");
  const hasCategoryEvidence =
    hasTokenContaining(lower, "skill") &&
    hasTokenContaining(lower, "combat") &&
    hasTokenContaining(lower, "lore");
  return achievementsMentions >= 2 || hasCategoryEvidence;
}

export function detectAchievementsTopTabTarget(snapshot: FrameSnapshot): DetectedTarget | null {
  if (snapshot.signals?.achievementsTopTabTarget) {
    return snapshot.signals.achievementsTopTabTarget;
  }
  const token = snapshot.tokens.find((t) => t.text.toLowerCase().includes("achievements"));
  if (!token?.rect) return null;
  return {
    rect: token.rect,
    confidence: token.confidence ?? 0.75,
  };
}

function deriveHeroRect(snapshot: FrameSnapshot): Rect | null {
  const heroTokens = snapshot.tokens.filter((token) =>
    ["hero", "summary", "skills", "loadout", "achievements"].some((term) =>
      token.text.toLowerCase().includes(term),
    ),
  );
  const rects = heroTokens.map((token) => token.rect).filter((rect): rect is Rect => !!rect);
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
