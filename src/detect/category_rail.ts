import { CategorySchema, FrameSnapshot, PrimaryCategory, Rect } from "../types.js";
import { hasTokenContaining, normalizedTokenTexts } from "./text_utils.js";

export type CategoryRailState = {
  visibleCategories: Set<PrimaryCategory>;
  categoryRailRect: Rect;
};

export function detectCategoryRail(
  snapshot: FrameSnapshot,
  schema: CategorySchema,
): CategoryRailState {
  if (snapshot.signals?.categoryRailRect) {
    return {
      visibleCategories: new Set(snapshot.signals.visibleCategories ?? []),
      categoryRailRect: snapshot.signals.categoryRailRect,
    };
  }
  const lowerTokens = normalizedTokenTexts(snapshot);
  const visibleCategories = new Set<PrimaryCategory>();
  for (const category of schema.categories) {
    const anchor = category.name.split(" ")[0] ?? category.name;
    if (hasTokenContaining(lowerTokens, anchor)) {
      visibleCategories.add(category.name);
    }
  }
  const rect = deriveCategoryRailRect(snapshot);
  return {
    visibleCategories,
    categoryRailRect: rect ?? { x: 0, y: 0, width: 1, height: 1 },
  };
}

export function hasAllCategoriesVisible(
  rail: CategoryRailState,
  expectedCount = 9,
): boolean {
  return rail.visibleCategories.size === expectedCount;
}

function deriveCategoryRailRect(snapshot: FrameSnapshot): Rect | null {
  const rects = snapshot.tokens.map((token) => token.rect).filter((rect): rect is Rect => !!rect);
  if (rects.length === 0) return null;
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}
