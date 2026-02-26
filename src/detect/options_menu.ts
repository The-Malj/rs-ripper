import { DetectedTarget, FrameSnapshot, Rect } from "../types.js";
import {
  countTokensContaining,
  hasTokenContaining,
  normalizedTokenTexts,
} from "./text_utils.js";

const OPTIONS_ANCHORS = ["options", "menu", "layout", "logout"];

export function detectOptionsMenu(snapshot: FrameSnapshot): DetectedTarget | null {
  if (snapshot.signals?.optionsMenuTarget) {
    return snapshot.signals.optionsMenuTarget;
  }
  const heroToken = snapshot.tokens.find((t) => t.text.toLowerCase().includes("hero"));
  if (heroToken?.rect) {
    const expanded = deriveDynamicRect(snapshot) ?? heroToken.rect;
    return { rect: expanded, confidence: 0.62 };
  }
  if (snapshot.signals?.hasOptionsMenu) {
    const rectFromSignals = deriveDynamicRect(snapshot);
    if (rectFromSignals) {
      return { rect: rectFromSignals, confidence: 0.65 };
    }
  }
  const lower = normalizedTokenTexts(snapshot);
  const hits = OPTIONS_ANCHORS.filter((anchor) =>
    hasTokenContaining(lower, anchor),
  ).length;
  if (hits < 1) return null;
  const rect = deriveDynamicRect(snapshot);
  if (!rect) return null;
  return { rect, confidence: Math.min(1, 0.45 + hits * 0.2) };
}

export function detectHeroButtonInOptions(snapshot: FrameSnapshot): DetectedTarget | null {
  if (snapshot.signals?.heroButtonTarget) {
    return snapshot.signals.heroButtonTarget;
  }
  const normalized = normalizedTokenTexts(snapshot);
  const hasHeroText = countTokensContaining(normalized, "hero") > 0;
  const token = snapshot.tokens.find((t) => t.text.toLowerCase().includes("hero"));
  if (token?.rect) {
    return {
      rect: token.rect,
      confidence: token.confidence ?? 0.75,
    };
  }
  if (!hasHeroText) return null;
  const rect = deriveDynamicRect(snapshot);
  if (!rect) return null;
  return { rect, confidence: 0.55 };
}

function deriveDynamicRect(snapshot: FrameSnapshot): Rect | null {
  const tokenRects = snapshot.tokens.map((token) => token.rect).filter((rect): rect is Rect => !!rect);
  if (tokenRects.length === 0) return null;
  const minX = Math.min(...tokenRects.map((r) => r.x));
  const minY = Math.min(...tokenRects.map((r) => r.y));
  const maxX = Math.max(...tokenRects.map((r) => r.x + r.width));
  const maxY = Math.max(...tokenRects.map((r) => r.y + r.height));
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}
